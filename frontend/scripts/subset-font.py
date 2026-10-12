"""Builds the self-hosted Archivo subset used by the site.

Source: @fontsource-variable/archivo (OFL-1.1), latin, width + weight axes.
The width axis is limited to the stretches the design uses (100-120%) and the
weight axis to 400-800, then glyphs are subset to Basic Latin, Latin-1
punctuation, and typographic quotes (enough for Indonesian copy).

Run from frontend/: python scripts/subset-font.py   (needs fonttools + brotli)
"""
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SOURCE = "node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2"
TARGET = "src/assets/fonts/archivo-solveit.woff2"

font = TTFont(SOURCE)
font = instancer.instantiateVariableFont(font, {"wdth": (100, 120), "wght": (400, 800)})

options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["kern", "liga", "calt", "tnum", "lnum", "case"]
options.name_IDs = ["*"]
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=list(range(0x20, 0x7F)) + [0xA0, 0xA9, 0xB7, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x2192])
subsetter.subset(font)
font.flavor = "woff2"
font.save(TARGET)
print(TARGET)
