const express = require('express');

const router = express.Router();

const submissionController = require('../controller/submissionController');

const { requireAuth } = require('../middleware/auth');



router.post('/verdict', requireAuth(), submissionController.reportVerdict);



module.exports = router;

