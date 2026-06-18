namespace HungSilver.WebApi.Common;

public sealed class ApiResponse<T>
{
    public T? Data { get; set; }
    public bool IsSuccess { get; set; }
    public string Message { get; set; } = "";
    public int StatusCode { get; set; }
}

public static class ApiResponse
{
    public static ApiResponse<T> Ok<T>(T? data, int statusCode = 200) => new()
    {
        Data = data,
        IsSuccess = true,
        Message = "",
        StatusCode = statusCode
    };

    public static ApiResponse<object> Fail(string message, int statusCode) => new()
    {
        Data = null,
        IsSuccess = false,
        Message = message,
        StatusCode = statusCode
    };
}
