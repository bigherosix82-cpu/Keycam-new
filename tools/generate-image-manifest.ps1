$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$productRoot = Join-Path $root "assets\product"
$thumbnailRoot = Join-Path $root "assets\thumbnail"
$outputFile = Join-Path $root "image-manifest.js"

# Create thumbnail folder if it doesn't exist
if (-not (Test-Path $thumbnailRoot)) {
    New-Item -ItemType Directory -Path $thumbnailRoot | Out-Null
}

$collectionMap = @{
    "abstrach and topographic" = "abstract-topographic"
    "anime" = "anime-manga"
    "Art" = "art"
    "China" = "chinese-traditional"
    "Japan" = "japanese-traditional"
    "cyberpunk" = "sci-fi-cyberpunk"
    "dark fantasy and gothic" = "dark-fantasy-mythology"
    "Game" = "retro-gaming"
    "Girly kawaii" = "kawaii-aesthetic"
    "lofi" = "synthwave-lofi"
    "minimalist" = "minimalist-aesthetic"
    "mthyology and factasy" = "dark-fantasy-mythology"
    "nature" = "nature-landscapes"
    "space" = "space-galaxy"
    "urban cityscapes" = "urban-cityscapes"
    "vintage" = "vintage-aesthetic"
    "wildlife and animal" = "nature-landscapes"
}

$allowedExtensions = @(".jpg", ".jpeg", ".png", ".webp", ".gif")


function Convert-ToSlug($text) {

    $text = $text.ToLower()

    $text = $text -replace '[^a-z0-9]+', '-'

    $text = $text.Trim('-')

    if ([string]::IsNullOrWhiteSpace($text)) {
        $text = "design"
    }

    return $text
}


function Convert-ToName($filename, $folder, $number) {

    $name = [System.IO.Path]::GetFileNameWithoutExtension($filename)

    $name = $name -replace '[_]+', ' '
    $name = $name -replace '[-]+', ' '

    $name = $name -replace '(?i)\b\d{3,4}t\s*2x\b', ''
    $name = $name -replace '(?i)\b\d{3,4}t\b', ''
    $name = $name -replace '(?i)\b\d{3,4}x\d{3,4}\b', ''
    $name = $name -replace '(?i)\b\d{3,4}p\b', ''
    $name = $name -replace '(?i)\b4k\b', ''
    $name = $name -replace '(?i)\b2k\b', ''
    $name = $name -replace '(?i)\bhd\b', ''

    $name = $name -replace '(?i)\bwallpaper(s)?\b', ''
    $name = $name -replace '(?i)\bdesktop\b', ''
    $name = $name -replace '(?i)\bdigital art\b', ''
    $name = $name -replace '(?i)\bvideo games?\b', ''
    $name = $name -replace '(?i)\btv series\b', ''

    $name = $name -replace '(?i)\s+by\s+.*$', ''

    $name = $name -replace '(?i)\b(dm[a-z0-9]+)\b', ''
    $name = $name -replace '(?i)\b[a-z0-9]{7,}\b', ''

    $name = $name -replace '(?<![a-z])\d{5,}(?![a-z])', ''

    $words = $name -split '\s+' | Where-Object { $_ -ne "" }

    $cleanWords = @()

    foreach ($word in $words) {

        if (
            $cleanWords.Count -eq 0 -or
            $cleanWords[-1].ToLower() -ne $word.ToLower()
        ) {
            $cleanWords += $word
        }
    }

    $name = $cleanWords -join ' '

    $name = $name -replace '\s+', ' '

    $name = $name.Trim()

    if ([string]::IsNullOrWhiteSpace($name)) {
        return "$folder Design $number"
    }

    $name = $name.ToLower()

    return (Get-Culture).TextInfo.ToTitleCase($name)
}


$items = @()


Get-ChildItem -Path $productRoot -Directory | ForEach-Object {

    $collectionFolder = $_

    $folder = $collectionFolder.Name


    if (-not $collectionMap.ContainsKey($folder)) {

        Write-Host "Skipping unmapped folder: $folder" -ForegroundColor Yellow

        return
    }


    $collection = $collectionMap[$folder]

    $number = 0


    # Scan files recursively.
    # Direct files = no series.
    # Files inside a subfolder = that subfolder becomes the series.

    Get-ChildItem `
        -Path $collectionFolder.FullName `
        -File `
        -Recurse |
        Sort-Object FullName |
        ForEach-Object {


        if ($allowedExtensions -notcontains $_.Extension.ToLower()) {
            return
        }


        $number++


        $relativePath = $_.FullName.Substring($root.Length + 1)

        $relativePath = $relativePath -replace '\\', '/'
# =========================
# CREATE SMALL WEBP THUMBNAIL
# =========================

# Path relative to assets/product
$relativeToProduct = $_.FullName.Substring($productRoot.Length + 1)
$relativeToProduct = $relativeToProduct -replace '\\', '/'

# Remove original extension and build matching thumbnail path
$thumbnailRelative = [System.IO.Path]::ChangeExtension(
    $relativeToProduct,
    ".webp"
)

# Put thumbnail under assets/thumbnail
$thumbnailRelative = $thumbnailRelative -replace '^(.+)$', 'assets/thumbnail/$1'

$thumbnailFile = Join-Path `
    $root `
    ($thumbnailRelative -replace '/', '\')

$thumbnailDirectory = Split-Path $thumbnailFile -Parent

# Create thumbnail directory if needed
if (-not (Test-Path $thumbnailDirectory)) {
    New-Item -ItemType Directory -Path $thumbnailDirectory -Force | Out-Null
}

# Create thumbnail if it doesn't already exist
if (-not (Test-Path $thumbnailFile)) {

    Write-Host "Creating thumbnail: $($_.Name)" -ForegroundColor DarkGray

    & magick $_.FullName `
        -auto-orient `
        -resize "800x800>" `
        -strip `
        -quality 82 `
        $thumbnailFile

    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $thumbnailFile)) {
        Write-Host "WARNING: Failed to create thumbnail for $($_.Name)" -ForegroundColor Yellow
        $thumbnailPath = $null
    }
    else {
        $thumbnailPath = $thumbnailRelative
    }
}
else {
    $thumbnailPath = $thumbnailRelative
}

        # Default: no series
        $series = $null
        $seriesName = $null


        # Find the first folder below the collection folder.
        $relativeToCollection =
            $_.FullName.Substring($collectionFolder.FullName.Length).TrimStart('\', '/')


        $pathParts = $relativeToCollection -split '[\\/]'


        if ($pathParts.Count -gt 1) {

            $seriesName = $pathParts[0]

            $series = Convert-ToSlug $seriesName
        }


        # Build unique ID
        $idParts = @($folder)

        if ($series) {
            $idParts += $series
        }

        $idParts += $_.BaseName


        $idBase = Convert-ToSlug ($idParts -join '-')

        $id = "stock-$idBase"


        $items += [ordered]@{

    id         = $id

    name       = Convert-ToName $_.Name $folder $number

    image      = $relativePath

    thumbnail  = $thumbnailPath

    collection = $collection

    folder     = $folder

    series     = $series

    seriesName = $seriesName
}
    }
}


$json = $items | ConvertTo-Json -Depth 5


$content = @"
window.KEYCAM_IMPORTED_IMAGES = $json;
"@


Set-Content `
    -Path $outputFile `
    -Value $content `
    -Encoding UTF8


$detectedSeries = @(
    $items |
    Where-Object { $_["series"] } |
    ForEach-Object { $_["series"] } |
    Sort-Object -Unique
)


Write-Host ""

Write-Host "KeyCam image manifest generated!" -ForegroundColor Green

Write-Host "Images found: $($items.Count)" -ForegroundColor Cyan

Write-Host "Output: image-manifest.js" -ForegroundColor Cyan

Write-Host "Series detected: $($detectedSeries.Count)" -ForegroundColor Magenta


if ($detectedSeries.Count -gt 0) {

    Write-Host ""

    Write-Host "Detected series:" -ForegroundColor Magenta

    $detectedSeries |
        ForEach-Object {
            Write-Host " - $_"
        }
}


Write-Host ""