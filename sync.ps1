# sync.ps1 -- Sincroniza alteracoes com GitHub (que dispara deploy no Vercel)
# Uso: .\sync.ps1 "descricao da alteracao"
#      .\sync.ps1                            (usa mensagem automatica com data/hora)

$GIT = "C:\Program Files\Git\cmd\git.exe"
$mensagem = if ($args[0]) { $args[0] } else { "update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }

Write-Host ""
Write-Host "[SYNC] Sincronizando alteracoes..." -ForegroundColor Cyan
Write-Host "       Mensagem: $mensagem" -ForegroundColor Gray
Write-Host ""

# Verifica se ha alteracoes
$status = & $GIT status --porcelain
if (-not $status) {
    Write-Host "[OK] Nenhuma alteracao encontrada. Tudo ja esta sincronizado!" -ForegroundColor Green
    exit 0
}

# Adiciona tudo
Write-Host "[1/3] Adicionando arquivos..." -ForegroundColor Yellow
& $GIT add .
if ($LASTEXITCODE -ne 0) { Write-Host "[ERRO] Falha ao adicionar arquivos." -ForegroundColor Red; exit 1 }

# Commit
Write-Host "[2/3] Criando commit..." -ForegroundColor Yellow
& $GIT commit -m $mensagem
if ($LASTEXITCODE -ne 0) { Write-Host "[ERRO] Falha ao criar commit." -ForegroundColor Red; exit 1 }

# Push para GitHub
Write-Host "[3/3] Enviando para GitHub..." -ForegroundColor Yellow
& $GIT push
if ($LASTEXITCODE -ne 0) { Write-Host "[ERRO] Falha ao enviar para GitHub." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "[OK] Sincronizado! O Vercel vai fazer o deploy automaticamente em ~30s." -ForegroundColor Green
Write-Host "     Acompanhe em: https://vercel.com/leonardo-cordeiros-projects-37339772/sisra" -ForegroundColor Gray
Write-Host ""
