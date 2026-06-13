# Pre-Deployment Checklist

## Before deploying, verify every item below:

### Environment
- [ ] `backend/.env` has real `MONGO_URI` (not localhost)
- [ ] `backend/.env` has strong `JWT_SECRET` (32+ characters)
- [ ] `backend/.env` has valid `GEMINI_API_KEY`
- [ ] `compiler/.env` has `MAIN_BACKEND_API_URL=http://backend:5000`
- [ ] `frontend/.env` has `VITE_API_BASE_URL` pointing to your EC2 IP
- [ ] `.env` files are in `.gitignore` (NEVER commit them)

### Docker
- [ ] `docker-compose up --build` runs without errors locally
- [ ] All 4 containers start: frontend, backend, compiler, mongodb
- [ ] `docker-compose ps` shows all containers as "Up"
- [ ] `docker-compose logs backend` shows "Connected to MongoDB"
- [ ] `GET http://localhost/api/health` returns `{"status":"ok"}`

### Security
- [ ] `hiddenTestCases` never appears in `GET /api/problems` response
- [ ] Sandbox network isolation verified (test 4.6 passes)
- [ ] Auth routes rate limited (test 2.6 passes)
- [ ] JWT cookies are HttpOnly (test 2.2 passes)

### Database
- [ ] Seed script run: `node scripts/seed.js`
- [ ] 10 problems visible at `/problems`
- [ ] Leaderboard shows demo users with correct solve counts
- [ ] Admin can create new problems after login

### CI/CD
- [ ] All GitHub secrets added to repo settings
- [ ] Push to a feature branch — CI workflow passes
- [ ] Merge to main — deploy workflow runs and succeeds

### Demo Readiness
- [ ] Live URL opens without errors
- [ ] Can register a new account
- [ ] Can solve Two Sum with a correct C++ solution
- [ ] AI hint button returns a hint
- [ ] Leaderboard shows correct rankings
- [ ] Admin account can create a new problem
