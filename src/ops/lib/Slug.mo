import Text "mo:core/Text";
import Char "mo:core/Char";
import Nat "mo:core/Nat";

/// Identifier validation for everything written to `ops` state.
///
/// This exists so "no free text on chain" is a property the code ENFORCES
/// rather than a rule reviewers have to remember. An unconstrained `Text`
/// field is exactly how a participant's name eventually ends up on a public,
/// permanent ledger — see claude/personal-data-on-chain.md §2 and §5a.
///
/// A slug is a categorical identifier, not prose: lowercase `a-z`, digits, and
/// hyphen, 1..32 characters. That is narrow enough that a sentence, an email
/// or a name cannot be smuggled through it.
module {

  public let maxLength : Nat = 32;

  public func isValid(t : Text) : Bool {
    let n = t.size();
    if (n == 0 or n > maxLength) { return false };
    for (c in t.toArray().values()) {
      let ok = (c >= 'a' and c <= 'z') or c.isDigit() or c == '-';
      if (not ok) { return false };
    };
    // Leading/trailing hyphens make identifiers that differ only in
    // punctuation, which reads as two things but sorts as near-duplicates.
    if (t.toArray()[0] == '-' or t.toArray()[n - 1] == '-') { return false };
    true;
  };

  /// True when every entry is a valid slug and none repeats.
  public func allValidAndDistinct(items : [Text]) : Bool {
    for (i in items.keys()) {
      if (not isValid(items[i])) { return false };
      for (j in items.keys()) {
        if (j > i and items[i] == items[j]) { return false };
      };
    };
    true;
  };
};
