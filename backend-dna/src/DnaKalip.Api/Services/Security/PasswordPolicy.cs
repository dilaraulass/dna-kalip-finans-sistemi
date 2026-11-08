namespace DnaKalip.Api.Services.Security;

public static class PasswordPolicy
{
    public const int MinLength = 12;
    public const int MaxLength = 128;

    // Existing authentication trims passwords; keep creation/reset consistent with it.
    public static string? Validate(string? password)
    {
        if (string.IsNullOrWhiteSpace(password)) return "Şifre zorunludur.";
        var length = password.Trim().Length;
        return length < MinLength || length > MaxLength
            ? $"Şifre {MinLength}–{MaxLength} karakter olmalıdır. Uzun bir şifre cümlesi kullanabilirsiniz."
            : null;
    }
}
