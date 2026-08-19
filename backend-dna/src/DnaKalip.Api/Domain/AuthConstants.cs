namespace DnaKalip.Api.Domain;

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Accounting = "Accounting";

    public static readonly string[] All = [Admin, Accounting];
}

public static class AuthPolicies
{
    public const string AuthenticatedUser = "AuthenticatedUser";
    public const string AdminOnly = "AdminOnly";
}
