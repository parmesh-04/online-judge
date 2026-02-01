const express = require('express');
const router = express.Router();
const problemController = require('../controller/problemController');
const { requireAuth } = require('../middleware/auth');

router.get('/', problemController.getAllProblems);
router.get('/:id', problemController.getProblem);
router.post('/', requireAuth({ role: 'admin' }), problemController.createProblem);
router.delete('/:id', requireAuth({ role: 'admin' }), problemController.deleteProblem);

module.exports = router;
