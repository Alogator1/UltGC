// Generate human-readable 6-character room codes
// Pattern: Consonant-Vowel-Digit-Consonant-Vowel-Digit
// Avoids confusing characters: 0/O, 1/I/L
// ~4.9 million possible combinations

const CONSONANTS = 'BCDFGHJKMNPQRSTVWXYZ'; // 20 chars (no L)
const VOWELS = 'AEIOU'; // 5 chars
const DIGITS = '2345679'; // 7 chars (no 0, 1, 8)

export function generateRoomCode() {
  let code = '';
  code += CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)];
  code += VOWELS[Math.floor(Math.random() * VOWELS.length)];
  code += DIGITS[Math.floor(Math.random() * DIGITS.length)];
  code += CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)];
  code += VOWELS[Math.floor(Math.random() * VOWELS.length)];
  code += DIGITS[Math.floor(Math.random() * DIGITS.length)];
  return code;
}
