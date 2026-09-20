# Personal data on chain — the storage rule

**Status.** Authored 2026-09-20. The original was never in this repo, so this is
a fresh statement of the rule, not a recovery of it. Claims are tagged:
**[RULE]** binding instruction from Ahmed · **[VERIFIED]** proven this session ·
**[PROPOSED]** recommendation, needs sign-off · **[NEEDS INPUT]** only Ahmed or
UNDP can settle.

This document is **binding**. CLAUDE.md §1 is its summary; if the two ever
disagree, fix both — do not follow the looser one.

---

## 1. Why this rule exists

**[RULE]** On-chain state is **public**, **permanent**, and **unredactable**.

Three properties, each independently fatal for personal data:

- **Public.** Canister memory on a standard application subnet is readable by
  node operators, and any query method you expose is readable by everyone.
  "We didn't write a getter" is not access control.
- **Permanent.** There is no delete. An upgrade does not erase history; a
  reinstall does not erase what was already observed and copied.
- **Unredactable.** Once a value is written and seen, no later action removes it
  from the copies others already hold.

The practical consequence: **a mistake here cannot be fixed later.** Every other
class of bug in this repo is recoverable. This one is not. That asymmetry is why
the rule is absolute rather than risk-weighted.

---

## 2. Never on chain

**[RULE]** In any canister, in any field, in any environment including local:

- names, emails, phone numbers, addresses, or any direct identifier
- free text of any kind — notes, comments, descriptions, justifications,
  reasons, feedback
- evidence URLs or document links
- financial data — amounts, funding notes, bank details, disbursement records

**Free text is on this list for a specific reason.** A field typed `Text` with
no enumerated domain will eventually contain whatever a human typed into it,
including a name, a phone number, or a sentence about someone's circumstances.
The type system cannot stop it, review will not catch every instance, and it is
permanent. Closed variants instead of open text is therefore a *storage* rule
here, not a style preference.

---

## 3. Allowed on chain

**[RULE]** Only:

- **opaque participant IDs** — random, meaningless outside the off-chain store
- **role** — a closed variant
- **cohort** — an identifier for a group, not a person
- **status** — a closed variant
- **categorical enums** generally
- **cryptographic digests**, subject to §4

---

## 4. Digests are not automatically safe

**[PROPOSED]** This is the subtlety most likely to cause an accidental breach,
so it gets its own rule.

**Hashing a low-entropy value does not anonymise it.** If you store
`sha256(email)`, anyone with a list of candidate emails can hash each one and
match. The same applies to phone numbers, national ID numbers, dates of birth,
and any combination of small fields. The digest is as re-identifiable as the
input space is small — and for a known accelerator cohort, the input space is
very small.

Therefore:

- **A digest may only be stored if its input contains a high-entropy secret**
  (a random salt or nonce of at least 128 bits) that is **not** on chain.
- **Never** store a digest of a bare identifier.
- Credential digests are fine **[PROPOSED]** when the hashed document contains a
  random credential ID, because that supplies the entropy.
- Storing the salt on chain defeats the salt. It lives in the off-chain store.

**[NEEDS INPUT]** Whether UNDP's data-protection position treats a salted digest
of personal data as personal data at all. Jurisdictions differ, and the answer
changes whether §4 is sufficient or whether digests of personal data are barred
outright. This is a UNDP call, not an engineering one.

---

## 5. The two-store model

**[RULE]**

| | On chain (`ops`, `registry`) | Off chain |
|---|---|---|
| Holds | opaque ID, role, cohort, status, digests | names, emails, evidence, funding notes |
| Property | public, permanent | access-controlled, **deletable** |
| Joins by | the opaque ID | the opaque ID |

The opaque ID is the only thing crossing the boundary. **[PROPOSED]** It must be
randomly generated, never derived from personal data — an ID derived from
`hash(email)` re-creates the §4 problem and silently makes the join key itself
identifying.

**[NEEDS INPUT]** Which off-chain store holds participant names. Still open;
blocks the `ops` data model (CLAUDE.md §7).

---

## 6. The erasure tension

**[PROPOSED]** State it plainly rather than discovering it during an audit.

A participant exercising a right to erasure can be honoured **in the off-chain
store only**. On-chain records cannot be deleted. The design answer is that
on-chain records must be non-identifying *by construction*, so that erasing the
off-chain record leaves behind nothing that identifies anyone — the opaque ID
becomes a dangling meaningless token.

**This only works if §2 and §4 were followed from the very first write.** It
cannot be retrofitted. That is the whole argument for the rule being absolute
from day one rather than tightened later.

**[NEEDS INPUT]** Confirmation from UNDP data protection that "opaque ID with no
retained mapping" satisfies erasure in their reading. If it does not, the
on-chain design needs to change *before* go-live, not after.

---

## 7. Review checklist for any new on-chain field

**[PROPOSED]** Every new field in `types.mo` answers these before it merges:

1. Is it a closed variant, a number, an opaque ID, or a §4-compliant digest?
   If it is `Text` and not one of those — **stop**.
2. Could its value differ per person in a way that narrows who they are?
   Consider combinations: role + cohort + status + a date can single someone out
   in a small cohort.
3. If this field were printed in a newspaper next to the cohort list, would
   anyone be harmed?
4. Is it needed on chain at all, or only for the off-chain UI?

**[RULE]** If a proposed model drifts toward anything in §2 — stop and flag it,
even if it was explicitly asked for. A field that "seems fine" is exactly the
failure mode this document exists to prevent.

---

## 8. Current compliance

**[VERIFIED]** As of 2026-09-20 neither canister stores any personal data.
`ops` and `registry` hold only: a set of admin `Principal`s, a bootstrap latch
(`Bool`), and a schema version (`Nat`). No participant data is modelled yet —
the `ops` data model is deliberately gated (CLAUDE.md §7) pending §5 and §6.
