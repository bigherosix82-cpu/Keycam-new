$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$productRoot = Join-Path $root "assets\product"

$allowedExtensions = @(
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif"
)

# ============================================================
# ANIME RULES
# ============================================================
# The script checks the filename for these keywords.
# Unknown Anime images stay directly inside assets\product\anime
# ============================================================

$animeRules = [ordered]@{

    "one-piece" = @(
        "one piece",
        "one-piece",
        "one_piece",
        "luffy",
        "zoro",
        "roronoa",
        "nami",
        "sanji",
        "usopp",
        "robin",
        "franky",
        "brook",
        "jinbe",
        "chopper",
        "ace",
        "sabo",
        "shanks",
        "mihawk"
    )

    "Naruto" = @(
        "naruto",
        "uzumaki",
        "sasuke",
        "uchiha",
        "itachi",
        "kakashi",
        "sakura",
        "hinata",
        "gaara",
        "madara",
        "obito",
        "minato",
        "jiraiya",
        "tsunade",
        "shikamaru"
    )

    "demon-slayer" = @(
        "demon slayer",
        "demon-slayer",
        "demon_slayer",
        "kimetsu",
        "tanjiro",
        "nezuko",
        "zenitsu",
        "inosuke",
        "giyu",
        "giyuu",
        "shinobu",
        "rengoku",
        "mitsuri",
        "muichiro",
        "obanai",
        "sanemi",
        "gyomei",
        "akaza",
        "muzan"
    )

    "jjk" = @(
        "jujutsu kaisen",
        "jujutsu-kaisen",
        "jujutsu_kaisen",
        "jjk",
        "gojo",
        "satoru gojo",
        "sukuna",
        "yuji itadori",
        "itadori",
        "megumi",
        "nobara",
        "yuta",
        "maki",
        "toji",
        "geto"
    )

    "atot" = @(
        "attack on titan",
        "attack-on-titan",
        "attack_on_titan",
        "aot",
        "eren",
        "mikasa",
        "levi",
        "armin",
        "reiner",
        "annie leonhart",
        "hange",
        "hanji",
        "zeke"
    )

    "dragon-ball" = @(
        "dragon ball",
        "dragon-ball",
        "dragon_ball",
        "dragonball",
        "goku",
        "vegeta",
        "gohan",
        "trunks",
        "bulma",
        "piccolo",
        "frieza",
        "freeza",
        "broly",
        "cell",
        "majin buu",
        "beerus",
        "whis"
    )

    "bleach" = @(
        "bleach",
        "ichigo",
        "kurosaki",
        "rukia",
        "renji",
        "byakuya",
        "aizen",
        "kenpachi",
        "yoruichi",
        "urahara",
        "toshiro",
        "hitsugaya",
        "ulquiorra",
        "grimmjow"
    )

    "chainsaw-man" = @(
        "chainsaw man",
        "chainsaw-man",
        "chainsaw_man",
        "chainsawman",
        "denji",
        "makima",
        "power",
        "aki hayakawa",
        "kobeni",
        "pochita",
        "reze"
    )

    "solo-leveling" = @(
        "solo leveling",
        "solo-leveling",
        "solo_leveling",
        "sung jinwoo",
        "sung jin-woo",
        "jinwoo",
        "jin-woo",
        "igris",
        "beru"
    )

    "my-hero-academia" = @(
        "my hero academia",
        "my-hero-academia",
        "my_hero_academia",
        "boku no hero",
        "bnha",
        "mha",
        "deku",
        "izuku midoriya",
        "bakugo",
        "bakugou",
        "todoroki",
        "uraraka",
        "shigaraki",
        "all might"
    )

    "hunter-x-hunter" = @(
        "hunter x hunter",
        "hunter-x-hunter",
        "hunter_x_hunter",
        "hxh",
        "gon freecss",
        "killua",
        "kurapika",
        "leorio",
        "hisoka",
        "chrollo"
    )

    "death-note" = @(
        "death note",
        "death-note",
        "death_note",
        "light yagami",
        "kira",
        "l lawliet",
        "near",
        "mello",
        "ryuk",
        "rem"
    )

    "spy-x-family" = @(
        "spy x family",
        "spy-x-family",
        "spy_x_family",
        "spyxfamily",
        "anya forger",
        "loid forger",
        "yor forger",
        "bond forger"
    )

    "jujutsu-kaisen" = @(
        "jujutsu kaisen 0",
        "jujutsu-kaisen 0"
    )
}


# ============================================================
# GAME RULES
# ============================================================

$gameRules = [ordered]@{

    "LOL" = @(
        "league of legends",
        "league-of-legends",
        "league_of_legends",
        "leagueoflegends",
        "lol",
        "ahri",
        "akali",
        "jinx",
        "yasuo",
        "yone",
        "lux",
        "zed",
        "katarina",
        "ezreal",
        "kaisa",
        "kai'sa",
        "leesin",
        "lee sin",
        "sett",
        "viego",
        "ekko",
        "riven",
        "irelia",
        "thresh",
        "jinx",
        "vi",
        "caitlyn",
        "arcane"
    )

    "Pubg" = @(
        "pubg",
        "pubg mobile",
        "pubg-mobile",
        "playerunknown",
        "battlegrounds",
        "battle grounds",
        "m416",
        "akm",
        "awm",
        "kar98",
        "ump45",
        "groza",
        "scar-l",
        "scar l",
        "pan pubg",
        "erangel",
        "miramar",
        "livik",
        "sanhok"
    )

    "Valorant" = @(
        "valorant",
        "jett",
        "sage",
        "omen",
        "viper",
        "reyna",
        "raze",
        "cypher",
        "killjoy",
        "chamber",
        "yoru",
        "neon",
        "fade",
        "gekko",
        "clove",
        "iso",
        "waylay",
        "vyse",
        "sova",
        "brimstone",
        "phoenix",
        "breach",
        "skye"
    )
}


# ============================================================
# HELPER
# ============================================================

function Normalize-Text($text) {

    $text = $text.ToLower()

    # Make different filename separators equivalent
    $text = $text -replace '[_\-]+', ' '

    # Collapse spaces
    $text = $text -replace '\s+', ' '

    return $text.Trim()
}


function Find-Match($filename, $rules) {

    $normalized = Normalize-Text $filename

    foreach ($folder in $rules.Keys) {

        foreach ($keyword in $rules[$folder]) {

            $keywordNormalized = Normalize-Text $keyword

            if ($normalized.Contains($keywordNormalized)) {
                return $folder
            }
        }
    }

    return $null
}


function Move-ImageToFolder($file, $destinationFolder) {

    if (-not (Test-Path $destinationFolder)) {
        New-Item -ItemType Directory -Path $destinationFolder | Out-Null
    }

    $destination = Join-Path $destinationFolder $file.Name

    # Never overwrite an existing image.
    if (Test-Path $destination) {

        Write-Host "Already exists, skipping: $($file.Name)" -ForegroundColor Yellow

        return
    }

    Move-Item -LiteralPath $file.FullName -Destination $destination

    Write-Host "Moved: $($file.Name)" -ForegroundColor Green
}


# ============================================================
# ANIME
# ============================================================

$animeRoot = Join-Path $productRoot "anime"

if (Test-Path $animeRoot) {

    Write-Host ""
    Write-Host "================ ANIME ================" -ForegroundColor Cyan

    # IMPORTANT:
    # Only scan files directly inside anime.
    # Files already inside series folders are left alone.

    Get-ChildItem -Path $animeRoot -File |
        Where-Object {
            $allowedExtensions -contains $_.Extension.ToLower()
        } |
        ForEach-Object {

            $file = $_

            $series = Find-Match $file.BaseName $animeRules

            if ($series) {

                $destination =
                    Join-Path $animeRoot $series

                Move-ImageToFolder $file $destination
            }
            else {

                Write-Host "Unknown Anime - keeping in All Anime: $($file.Name)" -ForegroundColor DarkGray
            }
        }
}


# ============================================================
# GAME
# ============================================================

$gameRoot = Join-Path $productRoot "Game"

if (Test-Path $gameRoot) {

    Write-Host ""
    Write-Host "================ GAME ================" -ForegroundColor Cyan

    # Only scan files directly inside Game.
    # Existing LOL / Pubg / Valorant folders are left alone.

    Get-ChildItem -Path $gameRoot -File |
        Where-Object {
            $allowedExtensions -contains $_.Extension.ToLower()
        } |
        ForEach-Object {

            $file = $_

            $game = Find-Match $file.BaseName $gameRules

            if ($game) {

                $destination =
                    Join-Path $gameRoot $game

                Move-ImageToFolder $file $destination
            }
            else {

                Write-Host "Unknown Game - keeping in Game: $($file.Name)" -ForegroundColor DarkGray
            }
        }
}


# ============================================================
# FINISHED
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Image organization finished!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""