using System.Text;
using System.Text.Json;
using HungSilver.Application.Abstractions;
using HungSilver.Application.AiCredentials;
using HungSilver.Application.Exams;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;

namespace HungSilver.Infrastructure.Exams;

/// <summary>
/// Sinh đề từ tài liệu upload (§A): chuẩn hóa PDF → Gemini vision (ép schema) → kiểm chứng 3 lớp →
/// tạo Exam nháp. Lớp 1 = validate cấu trúc + lỗ hổng số thứ tự (code); Lớp 2 = AI đối chiếu (tùy chọn);
/// Lớp 3 = GV duyệt (FE). Repair-retry khi JSON hỏng; câu sai cấu trúc bị bỏ + cảnh báo.
/// </summary>
public sealed class ExamGenerationService(
    IRepository<LearningMaterial> materials,
    IRepository<Exam> exams,
    IRepository<ExamQuestionGroup> groups,
    IRepository<ExamQuestion> questions,
    IUnitOfWork unitOfWork,
    IAiCredentialResolver resolver,
    IGeminiClient gemini,
    IExamSourceProvider sourceProvider) : IExamGenerationService
{
    private static readonly JsonSerializerOptions ParseOpts = new() { PropertyNameCaseInsensitive = true };

    public async Task<Result<ExamGenerationResult>> GenerateFromMaterialAsync(
        Guid materialId, GenerateExamRequest request, Guid userId, CancellationToken ct = default)
    {
        var material = await materials.GetByIdAsync(materialId, ct: ct);
        if (material is null)
            return Result.Failure<ExamGenerationResult>(Error.NotFound("Exam.MaterialNotFound", "Không tìm thấy tài liệu."));
        if (material.Source != MaterialSource.ServerFile || material.StoredFileId is null)
            return Result.Failure<ExamGenerationResult>(Error.Validation("Exam.NoFile", "Tài liệu cần là file upload (PDF/Word) để phân tích."));

        var credResult = await resolver.ResolveForUserAsync(userId, ct);
        if (credResult.IsFailure) return Result.Failure<ExamGenerationResult>(credResult.Error);
        var cred = credResult.Value;

        var partResult = await sourceProvider.GetPdfPartAsync(material.StoredFileId.Value, ct);
        if (partResult.IsFailure) return Result.Failure<ExamGenerationResult>(partResult.Error);
        var docPart = partResult.Value;

        // ---- Gọi Gemini (ép schema) + repair-retry parse ----
        var system = BuildSystemPrompt();
        var basePrompt = BuildUserPrompt(request);
        var temperature = request.Mode == ExamGenerationMode.Extract ? 0.1 : 0.6;

        GenExamPayload? payload = null;
        string? parseError = null;
        for (var attempt = 1; attempt <= 2 && payload is null; attempt++)
        {
            var prompt = attempt == 1
                ? basePrompt
                : basePrompt + $"\n\nLƯU Ý: lần trước JSON không hợp lệ ({parseError}). Trả về DUY NHẤT JSON đúng schema.";

            // Không đặt maxOutputTokens: để mặc định = trần của từng model (thinking tokens cũng tính vào trần,
            // đặt cứng dễ gây cắt dở JSON hoặc 400 với model trần thấp).
            var genResult = await gemini.GenerateContentAsync(
                new GeminiContentRequest(cred.ApiKey, cred.Model, system, prompt, new[] { docPart }, ExamSchemaJson, temperature),
                ct);
            if (genResult.IsFailure) return Result.Failure<ExamGenerationResult>(genResult.Error);

            payload = TryParse(genResult.Value, out parseError);
        }

        if (payload?.Groups is null || payload.Groups.Count == 0)
            return Result.Failure<ExamGenerationResult>(Error.Failure("Exam.ParseFailed", "AI không trả về câu hỏi hợp lệ. Thử lại hoặc đổi tài liệu."));

        // ---- Lớp 1: validate + build entities ----
        var warnings = new List<string>();
        var dropped = 0;

        var exam = new Exam
        {
            MaterialId = material.Id,
            SubjectId = material.SubjectId,
            SubjectName = material.SubjectName,
            Title = string.IsNullOrWhiteSpace(request.Title) ? $"{material.Title} — Đề trắc nghiệm" : request.Title!.Trim(),
            GradeBand = material.GradeBand,
            DurationMinutes = request.DurationMinutes is > 0 ? request.DurationMinutes!.Value : 60,
            TotalPoints = 10m,
            Status = ExamStatus.Draft,
            Source = request.Mode == ExamGenerationMode.Extract ? ExamGenSource.Extracted : ExamGenSource.Generated,
            Language = "en",
            CreatedByUserId = userId
        };

        var pendingGroups = new List<ExamQuestionGroup>();
        var pendingQuestions = new List<ExamQuestion>();
        var groupOrder = 0;
        var questionOrder = 0;

        foreach (var g in payload.Groups)
        {
            ExamQuestionGroup? group = null;
            Guid? groupId = null;
            if (!string.IsNullOrWhiteSpace(g.Passage) || !string.IsNullOrWhiteSpace(g.Instruction)
                || !string.IsNullOrWhiteSpace(g.ExerciseLabel) || !string.IsNullOrWhiteSpace(g.Section))
            {
                group = new ExamQuestionGroup
                {
                    ExamId = exam.Id,
                    OrderNo = groupOrder++,
                    Section = Trunc(g.Section, 100),
                    ExerciseLabel = Trunc(g.ExerciseLabel, 150),
                    Instruction = g.Instruction?.Trim(),
                    Passage = g.Passage?.Trim()
                };
                groupId = group.Id;
            }

            var validInGroup = 0;
            var numbers = new List<int>();
            foreach (var q in g.Questions ?? new())
            {
                var built = BuildQuestion(q, exam.Id, groupId, ref questionOrder);
                if (built is null) { dropped++; continue; }
                pendingQuestions.Add(built);
                validInGroup++;
                if (q.Number is int n) numbers.Add(n);
            }

            if (group is not null && validInGroup > 0) pendingGroups.Add(group);
            CheckNumberGaps(numbers, g.ExerciseLabel, warnings);
        }

        if (pendingQuestions.Count == 0)
            return Result.Failure<ExamGenerationResult>(Error.Failure("Exam.NoValidQuestions", "Không trích được câu hỏi hợp lệ nào từ tài liệu."));

        DistributePoints(pendingQuestions, exam.TotalPoints);

        // ---- Lớp 2: AI đối chiếu (best-effort, không chặn) ----
        if (request.Verify)
        {
            var discrepancies = await CrossCheckAsync(cred, docPart, pendingQuestions, ct);
            if (!string.IsNullOrWhiteSpace(discrepancies))
                warnings.Add("Đối chiếu AI: " + discrepancies);
        }

        if (dropped > 0)
            warnings.Insert(0, $"Đã bỏ {dropped} câu không hợp lệ (cấu trúc/đáp án thiếu) — hãy bổ sung khi duyệt.");

        // ---- Lưu (đề nháp) ----
        await exams.AddAsync(exam, ct);
        foreach (var gr in pendingGroups) await groups.AddAsync(gr, ct);
        foreach (var q in pendingQuestions) await questions.AddAsync(q, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return new ExamGenerationResult(exam.Id, pendingQuestions.Count, dropped, warnings);
    }

    // ----------------- Lớp 1: build + validate 1 câu -----------------

    private static ExamQuestion? BuildQuestion(GenQuestion q, Guid examId, Guid? groupId, ref int order)
    {
        if (string.IsNullOrWhiteSpace(q.Stem) || string.IsNullOrWhiteSpace(q.Type)) return null;
        if (!Enum.TryParse<ExamQuestionType>(q.Type.Trim(), ignoreCase: true, out var type)) return null;

        // Dùng chung ExamQuestionFactory với luồng sửa đề — câu sai cấu trúc/đáp án ⇒ bỏ.
        var content = ExamQuestionFactory.Build(type, q.Options, q.OptionsRight, q.AnswerKey, q.AnswerBlanks, q.WordBox, q.AnswerPairs);
        if (content.IsFailure) return null;

        return new ExamQuestion
        {
            ExamId = examId,
            GroupId = groupId,
            OrderNo = order++,
            SourceNumber = q.Number,
            Type = type,
            Stem = q.Stem!.Trim(),
            OptionsJson = content.Value.OptionsJson,
            AnswerJson = content.Value.AnswerJson,
            Explanation = string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation!.Trim(),
            Points = 0m
        };
    }

    private static void DistributePoints(List<ExamQuestion> qs, decimal total)
    {
        if (qs.Count == 0) return;
        var each = Math.Round(total / qs.Count, 2, MidpointRounding.AwayFromZero);
        decimal running = 0;
        for (var i = 0; i < qs.Count; i++)
        {
            if (i == qs.Count - 1) qs[i].Points = Math.Round(total - running, 2);
            else { qs[i].Points = each; running += each; }
        }
    }

    private static void CheckNumberGaps(List<int> numbers, string? label, List<string> warnings)
    {
        if (numbers.Count < 2) return;
        var distinct = numbers.Distinct().OrderBy(n => n).ToList();
        var missing = new List<int>();
        for (var n = distinct[0]; n <= distinct[^1]; n++)
            if (!distinct.Contains(n)) missing.Add(n);
        if (missing.Count > 0)
            warnings.Add($"{label ?? "Nhóm"}: nghi thiếu câu số {string.Join(", ", missing)}.");
    }

    // ----------------- Lớp 2: AI đối chiếu bản trích vs nguồn -----------------

    private async Task<string?> CrossCheckAsync(ResolvedAiCredential cred, GeminiInlineDoc doc, List<ExamQuestion> qs, CancellationToken ct)
    {
        var extracted = string.Join(", ", qs.Where(q => q.SourceNumber is not null)
            .Select(q => q.SourceNumber!.Value).Distinct().OrderBy(n => n));
        var prompt =
            "Bản trích xuất hiện có các câu số: [" + extracted + "]. So với TÀI LIỆU gốc đính kèm, " +
            "liệt kê NGẮN GỌN (tiếng Việt) những câu BỊ THIẾU khỏi bản trích hoặc đáp án nghi SAI. " +
            "Trả JSON {\"issues\":[\"...\"]}. Nếu không có vấn đề, trả {\"issues\":[]}.";
        const string schema = "{\"type\":\"OBJECT\",\"properties\":{\"issues\":{\"type\":\"ARRAY\",\"items\":{\"type\":\"STRING\"}}},\"propertyOrdering\":[\"issues\"],\"required\":[\"issues\"]}";

        var res = await gemini.GenerateContentAsync(
            new GeminiContentRequest(cred.ApiKey, cred.Model, null, prompt, new[] { doc }, schema, 0.1), ct);
        if (res.IsFailure) return null; // best-effort — không chặn tạo đề

        try
        {
            var parsed = JsonSerializer.Deserialize<CrossCheckPayload>(StripFence(res.Value), ParseOpts);
            if (parsed?.Issues is { Count: > 0 } issues)
                return string.Join(" | ", issues.Take(10));
        }
        catch (JsonException) { /* bỏ qua — best-effort */ }
        return null;
    }

    private sealed class CrossCheckPayload
    {
        public List<string>? Issues { get; set; }
    }

    // ----------------- Parse + prompt + schema -----------------

    private static GenExamPayload? TryParse(string raw, out string? error)
    {
        error = null;
        try
        {
            return JsonSerializer.Deserialize<GenExamPayload>(StripFence(raw), ParseOpts);
        }
        catch (JsonException ex)
        {
            error = ex.Message;
            return null;
        }
    }

    private static string StripFence(string s)
    {
        s = s.Trim();
        if (s.StartsWith("```", StringComparison.Ordinal))
        {
            var nl = s.IndexOf('\n');
            if (nl >= 0) s = s[(nl + 1)..];
            if (s.EndsWith("```", StringComparison.Ordinal)) s = s[..^3];
        }
        return s.Trim();
    }

    private static string? Trunc(string? s, int max) =>
        string.IsNullOrWhiteSpace(s) ? null : (s.Length <= max ? s.Trim() : s.Trim()[..max]);

    private static string BuildSystemPrompt() =>
        "Bạn là chuyên gia khảo thí tiếng Anh. Đọc tài liệu (PDF đính kèm) và trả về bộ câu hỏi TRẮC NGHIỆM. " +
        "CHỈ dùng 4 loại: " +
        "SingleChoice (options là các lựa chọn {key,text}, answerKey là key đúng); " +
        "TrueFalse (answerKey là 'true' hoặc 'false'); " +
        "FillBlank (answerBlanks: mỗi ô một phần tử, các đáp án chấp nhận ngăn bởi '/', kèm wordBox nếu tài liệu có hộp từ); " +
        "Matching (options = cột trái {key,text}, optionsRight = cột phải {key,text}, answerPairs là các cặp {left,right} theo key). " +
        "Mỗi câu BẮT BUỘC có explanation bằng TIẾNG VIỆT giải thích vì sao đáp án đúng. " +
        "Giữ NGUYÊN VĂN nội dung tiếng Anh của câu hỏi/lựa chọn. " +
        "Gộp các câu dùng chung ngữ liệu (đoạn đọc/hội thoại/hộp từ) vào cùng một group kèm passage. " +
        "BỎ QUA phần Writing tự luận và Listening (cần audio). " +
        "Trả về DUY NHẤT JSON đúng schema, không kèm chữ nào khác.";

    private static string BuildUserPrompt(GenerateExamRequest req)
    {
        var sb = new StringBuilder();
        if (req.Mode == ExamGenerationMode.Extract)
        {
            sb.Append("Hãy TRÍCH XUẤT chính xác và ĐẦY ĐỦ tất cả câu hỏi trắc nghiệm có trong tài liệu, theo đúng thứ tự. ");
            sb.Append("Ghi số thứ tự gốc của mỗi câu vào 'number' và nhãn bài (vd 'Exercise 5') vào 'exerciseLabel'. ");
            sb.Append("Đáp án đúng đã được đánh dấu trong tài liệu (in đậm/gạch chân/điền sẵn/bảng đáp án) — lấy đúng đáp án đó. ");
            sb.Append("KHÔNG tự bịa câu, KHÔNG bỏ sót câu nào. Bỏ qua các phần Writing/Listening.");
        }
        else
        {
            var n = req.MaxQuestions is > 0 ? req.MaxQuestions!.Value : 20;
            var difficulty = string.IsNullOrWhiteSpace(req.Difficulty) ? "trung bình" : req.Difficulty!.Trim();
            sb.Append($"Dựa trên CHỦ ĐỀ và từ vựng/ngữ pháp trong tài liệu, hãy TẠO khoảng {n} câu hỏi trắc nghiệm MỚI ");
            sb.Append($"(không sao chép nguyên văn đề có sẵn), độ khó {difficulty}, đa dạng 4 loại. Đánh 'number' tăng dần từ 1.");
        }
        if (!string.IsNullOrWhiteSpace(req.Instructions))
            sb.Append(" Ghi chú thêm: ").Append(req.Instructions.Trim());
        return sb.ToString();
    }

    /// <summary>Schema OpenAPI-subset ép Gemini trả JSON đúng khung (propertyOrdering cố định thứ tự field).</summary>
    private const string ExamSchemaJson = """
    {
      "type":"OBJECT",
      "properties":{
        "groups":{"type":"ARRAY","items":{
          "type":"OBJECT",
          "properties":{
            "exerciseLabel":{"type":"STRING"},
            "section":{"type":"STRING"},
            "instruction":{"type":"STRING"},
            "passage":{"type":"STRING"},
            "questions":{"type":"ARRAY","items":{
              "type":"OBJECT",
              "properties":{
                "number":{"type":"INTEGER"},
                "type":{"type":"STRING","enum":["SingleChoice","TrueFalse","FillBlank","Matching"]},
                "stem":{"type":"STRING"},
                "options":{"type":"ARRAY","items":{"type":"OBJECT","properties":{"key":{"type":"STRING"},"text":{"type":"STRING"}},"propertyOrdering":["key","text"]}},
                "optionsRight":{"type":"ARRAY","items":{"type":"OBJECT","properties":{"key":{"type":"STRING"},"text":{"type":"STRING"}},"propertyOrdering":["key","text"]}},
                "answerKey":{"type":"STRING"},
                "answerBlanks":{"type":"ARRAY","items":{"type":"STRING"}},
                "wordBox":{"type":"ARRAY","items":{"type":"STRING"}},
                "answerPairs":{"type":"ARRAY","items":{"type":"OBJECT","properties":{"left":{"type":"STRING"},"right":{"type":"STRING"}},"propertyOrdering":["left","right"]}},
                "explanation":{"type":"STRING"}
              },
              "propertyOrdering":["number","type","stem","options","optionsRight","answerKey","answerBlanks","wordBox","answerPairs","explanation"],
              "required":["number","type","stem","explanation"]
            }}
          },
          "propertyOrdering":["exerciseLabel","section","instruction","passage","questions"],
          "required":["questions"]
        }}
      },
      "propertyOrdering":["groups"],
      "required":["groups"]
    }
    """;
}
