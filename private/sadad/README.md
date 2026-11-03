# private/sadad (confidential)

Local vault for SADAD WebCheckout 2.1 materials from Gmail (`developer@sadad.qa`).

**Gitignored** except this README. Never commit PDFs, extracted text, secrets, or test card details into tracked history via other paths.

## Contents (after export)

- `EMAIL.md` — thread summary + official steps
- `FIELD_MATRIX.md` — field/signature/callback/webhook checklist from the PDFs
- `1. Sadad_Integration_guide.pdf` (+ `.txt` extract)
- `2. sadad_signature_webcheckout.pdf` (+ `.txt`)
- `3. callback parameters.pdf` (+ `.txt`)
- `4. webhook_guide.pdf` (+ `.txt`)
- `test_post_demo_ENG.html` — sample form + signature walkthrough

## Usage

Drop or re-export vendor files here. Integration code must treat these PDFs as source of truth; do not put secret keys in this folder—use Vercel/env only.
