import express from 'express';

const router = express.Router();

const SUPPORTED_GAMES = [
  {
    id: 'rps',
    name: 'Rock Paper Scissors',
    description: 'Best of 3 rounds of classic RPS with 20-second turn timers.',
    rulesSummary: 'First to 2 wins takes the match. Tied rounds do not count as a win.'
  },
  {
    id: 'cricket',
    name: 'Hand Cricket',
    description: '3 overs per innings (18 legal deliveries) using numbers 1 to 6.',
    rulesSummary: 'Same numbers = batter out. Different numbers = batter scores runs. 1-over super-over tie breakers.'
  }
];

router.get('/games', (req, res) => {
  res.json({
    success: true,
    data: SUPPORTED_GAMES
  });
});

export default router;
