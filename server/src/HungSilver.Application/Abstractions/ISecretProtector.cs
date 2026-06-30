namespace HungSilver.Application.Abstractions;

/// <summary>Mã hóa/giải mã chuỗi nhạy cảm (vd API key) để lưu trữ an toàn ở DB.</summary>
public interface ISecretProtector
{
    string Protect(string plaintext);
    string Unprotect(string ciphertext);
}
