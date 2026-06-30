# Security Specification for Gabarito IA

## 1. Data Invariants
* A **Class** must be owned by a signed-in teacher (`ownerId == request.auth.uid`).
* Only the owner of a Class can read or write its details.
* Only the owner can manage students, exams, and correction results for that Class.
* All timestamp fields (`createdAt`) must match the server timestamp (`request.time`).
* Document IDs must be validated (`isValidId`).

## 2. The "Dirty Dozen" Payloads (Identity, Integrity, and State Violations)
Here are twelve payloads designed to test and potentially break security boundaries:

1. **Identity Spoofing in Class**: Create class with a fake `ownerId` of another teacher.
2. **Class Ghost Field Injection**: Inject `isVerifiedAdmin: true` into Class document.
3. **Invalid Id Poisoning in Class**: Create a class document with ID `/classes/very_long_junk_string_with_illegal_chars_$$$`.
4. **Time Manipulation in Class**: Create a class with a custom `createdAt` representing a past date or future date instead of `request.time`.
5. **Orphaned Student Creation**: Add a student to a class that the teacher does not own.
6. **Student ID Poisoning**: Write a student document with an invalid ID structure.
7. **Identity Spoofing in Student**: Attempt to save a student with an `ownerId` of another teacher.
8. **Invalid Score Range in GradedResult**: Save a correction result with a score of `15.5` (max should be 10.0) or negative score `-2.0`.
9. **Zero-Trust Bypassing on Exam Key Update**: Modify an existing exam's keys to delete questions.
10. **State Corruption in Result**: Inject a malicious string (1MB size) into the `aiFeedback` field.
11. **Bypassing Verification**: Attempt to write data without an `email_verified` flag being true.
12. **Unauthenticated Read**: Attempt to read the entire classes directory without signing in.

## 3. Security Rules Draft (DRAFT_firestore.rules)
Below is the draft security ruleset compiled according to the ABAC and Zero-Trust standards.
`firestore.rules` will enforce this exact validation structure.
