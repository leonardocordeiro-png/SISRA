# sync.ps1 — Sincroniza alterações com GitHub (que dispara deploy no Vercel)
# Uso: .\sync.ps1 "descrição da alteração"
#      .\sync.ps1                             (usa mensagem automática com data/hora)

$GIT = "C:\Program Files\Git\cmd\git.exe"
$mensagem = if ($args[0]) { $args[0] } else { "update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }

Write-Host ""
Write-Host "🔄 Sincronizando alterações..." -ForegroundColor Cyan
Write-Host "   Mensagem: $mensagem" -ForegroundColor Gray
Write-Host ""

# Verifica se há alterações
$status = & $GIT status --porcelain
if (-not $status) {
    Write-Host "✅ Nenhuma alteração encontrada. Tudo já está sincronizado!" -ForegroundColor Green
    exit 0
}

# Adiciona tudo
Write-Host "📦 Adicionando arquivos..." -ForegroundColor Yellow
& $GIT add .
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Erro ao adicionar arquivos." -ForegroundColor Red; exit 1 }

# Commit
Write-Host "💾 Criando commit..." -ForegroundColor Yellow
& $GIT commit -m $mensagem
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Erro ao criar commit." -ForegroundColor Red; exit 1 }

# Push para GitHub
Write-Host "🚀 Enviando para GitHub..." -ForegroundColor Yellow
& $GIT push
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Erro ao enviar para GitHub." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "✅ Sincronizado! O Vercel vai detectar e fazer o deploy automático em ~30s." -ForegroundColor Green
Write-Host "   Acompanhe em: https://vercel.com/leonardo-cordeiros-projects-37339772/sisra" -ForegroundColor Gray
Write-Host ""
