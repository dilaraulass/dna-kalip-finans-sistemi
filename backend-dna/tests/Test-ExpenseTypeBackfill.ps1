param(
    [string]$Server = 'localhost\SQL2022',
    [string]$Database = 'DnaKalipDb'
)

$ErrorActionPreference = 'Stop'
$migration = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../src/DnaKalip.Api/Migrations/20261014211212_AddExpenseTypes.cs') -Raw -Encoding UTF8
$match = [regex]::Match($migration, 'migrationBuilder.Sql\("""([\s\S]*?)"""\);')
if (-not $match.Success) { throw 'Backfill SQL not found.' }
$backfill = $match.Groups[1].Value.Replace('[ExpenseInvoices]', '[#Invoices]').Replace('[ExpenseTypes]', '[#Types]')

# Only session-local temporary tables are modified. Production tables are read only.
$setup = @'
SET NOCOUNT ON;
SET XACT_ABORT ON;
CREATE TABLE #Types (Id int IDENTITY PRIMARY KEY, Name nvarchar(150) COLLATE DATABASE_DEFAULT NOT NULL UNIQUE);
CREATE TABLE #Invoices (Id int IDENTITY PRIMARY KEY, InvoiceType nvarchar(150) COLLATE DATABASE_DEFAULT NULL, ExpenseTypeId int NULL);
INSERT INTO #Types (Name) VALUES (N'Diğer'), (N'Fason İşçilik'), (N'Hammadde'), (N'Standart Malzeme'), (N'Isıl İşlem'), (N'Tel Erezyon');
INSERT INTO #Invoices (InvoiceType) SELECT InvoiceType FROM dbo.ExpenseInvoices;
INSERT INTO #Invoices (InvoiceType) VALUES (NULL), (N''), (N'   '), (N' Hammadde '), (N'Test özel gider'), (N'Test özel gider');
SELECT * INTO #Before FROM #Invoices;
'@
$checks = @'
IF EXISTS (SELECT 1 FROM #Invoices WHERE ExpenseTypeId IS NULL)
    THROW 51001, 'Unmapped invoices remain.', 1;
IF EXISTS (
    SELECT 1 FROM #Invoices i JOIN #Types t ON t.Id = i.ExpenseTypeId
    WHERE t.Name <> COALESCE(NULLIF(LTRIM(RTRIM(i.InvoiceType)), N''), N'Diğer'))
    THROW 51002, 'Incorrect mapping.', 1;
IF EXISTS (SELECT Id, InvoiceType FROM #Before EXCEPT SELECT Id, InvoiceType FROM #Invoices)
    THROW 51003, 'Legacy data changed.', 1;
IF (SELECT COUNT(*) FROM #Types WHERE Name = N'Test özel gider') <> 1
    THROW 51004, 'Custom type duplicated.', 1;
SELECT COUNT(*) AS VerifiedInvoices FROM #Invoices;
'@
$connection = [System.Data.SqlClient.SqlConnection]::new("Server=$Server;Database=$Database;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=5")
try {
    $connection.Open()
    $command = $connection.CreateCommand()
    # Running the exact migration SQL twice also verifies repeat safety.
    $command.CommandText = $setup + "`n" + $backfill + "`n" + $backfill + "`n" + $checks
    $count = $command.ExecuteScalar()
    Write-Output "PASS: $count invoices mapped; custom/empty types, original text and repeat safety verified. No persistent data changed."
} finally {
    $connection.Dispose()
}
