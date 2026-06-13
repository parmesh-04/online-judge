// Purpose: Health check route used by Docker HEALTHCHECK and CI/CD.

const express = require('express');
const router = express.Router();
const healthController = require('../controller/healthController');

router.get('/', healthController.getHealth);

module.exports = router;
