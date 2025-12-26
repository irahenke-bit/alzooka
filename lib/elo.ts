// ELO Rating System for Trivia Games
// Based on the standard ELO formula used in chess

const K_FACTOR = 32; // How much a single game affects rating (32 is standard for new players)

/**
 * Calculate expected score (probability of winning)
 * @param playerRating - The player's current rating
 * @param opponentRating - The opponent's current rating
 * @returns Expected score between 0 and 1
 */
export function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculate new rating after a game
 * @param playerRating - The player's current rating
 * @param opponentRating - The opponent's current rating at the time of the game
 * @param actualScore - 1 for win, 0 for loss, 0.5 for draw
 * @returns The new rating
 */
export function calculateNewRating(
  playerRating: number,
  opponentRating: number,
  actualScore: number
): number {
  const expected = expectedScore(playerRating, opponentRating);
  const newRating = playerRating + K_FACTOR * (actualScore - expected);
  
  // Don't let rating go below 100
  return Math.max(100, Math.round(newRating));
}

/**
 * Calculate rating changes for both players after a match
 * @param player1Rating - Player 1's current rating
 * @param player2Rating - Player 2's current rating
 * @param player1Won - Whether player 1 won
 * @returns Object with new ratings for both players
 */
export function calculateMatchRatings(
  player1Rating: number,
  player2Rating: number,
  player1Won: boolean
): {
  player1NewRating: number;
  player2NewRating: number;
  player1Change: number;
  player2Change: number;
} {
  const player1Score = player1Won ? 1 : 0;
  const player2Score = player1Won ? 0 : 1;

  const player1NewRating = calculateNewRating(player1Rating, player2Rating, player1Score);
  const player2NewRating = calculateNewRating(player2Rating, player1Rating, player2Score);

  return {
    player1NewRating,
    player2NewRating,
    player1Change: player1NewRating - player1Rating,
    player2Change: player2NewRating - player2Rating,
  };
}

/**
 * Get a description of the rating change
 * @param change - The rating change (positive or negative)
 * @returns A human-readable description
 */
export function getRatingChangeDescription(change: number): string {
  if (change > 25) return "Huge upset! 🎉";
  if (change > 15) return "Great win! 💪";
  if (change > 0) return "Nice win";
  if (change === 0) return "No change";
  if (change > -15) return "Tough loss";
  if (change > -25) return "Bad loss 😬";
  return "Devastating loss 💀";
}

