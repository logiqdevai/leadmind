/**
 * Ordered level descriptions (lowest to highest) sent to Jev with every contact score question.
 * Jev's score is the 0-based probability-weighted level, so level index + 1 is the stored 1-10
 * ContactScore (see jevScoreToContactScore).
 */
export const JEV_CONTACT_SCORE_LEVELS: string[] = [
    '1 - Very poor fit: clearly contradicts the criteria',
    '2 - Poor fit: mostly contradicts the criteria',
    '3 - Weak fit: only a minor match to the criteria',
    '4 - Below average fit: some match, but important criteria are missing',
    '5 - Average fit: partially matches, with significant gaps or unknowns',
    '6 - Decent fit: matches the main criteria with some gaps',
    '7 - Good fit: matches most of the criteria',
    '8 - Very good fit: matches nearly all of the criteria',
    '9 - Excellent fit: matches all of the criteria',
    '10 - Perfect fit: matches all of the criteria with strong supporting evidence',
];
