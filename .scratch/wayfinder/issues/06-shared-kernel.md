Type: grilling
Status: resolved
Blocked by: 05

## Question

Do crap4ts and scrap4ts share a kernel package for the CRAP formula, sort order, and fixed-width report, or does each package own a copy?

The family formula and table widths are identical. SCRAP's report is a different product (guidance, not the CRAP table). The kernel, if any, might be formula + table helpers only, or also the parser adapter. Avoid a grab-bag `packages/shared`.

## Answer

No third workspace directory. Two packages only, as locked in [What are the two package names, binary names, and workspace layout?](05-package-layout.md).

crap4ts owns the CRAP formula, sort (score descending, `N/A` last), and the fixed-width CRAP table (`%-30s %-35s %4s %7s %8s`). scrap4ts owns the SCRAP guidance report. Do not copy CRAP table or formula code into scrap4ts.

The parser adapter is a seam inside a consumer, not a workspace package. Its interface stays with [What is the parser adapter's type?](07-parser-adapter.md).

Rejected: a formula/table kernel (one caller), a parser-adapter-only third package, a grab-bag `packages/shared`, and literal copies of CRAP report code in both packages. The family copies formula across language repos, not across CRAP and SCRAP.
