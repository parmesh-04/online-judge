#!/usr/bin/env node

// seed.js — Database seeding script for Online Judge
// Run with: node scripts/seed.js
// Run inside Docker with: docker compose exec backend node scripts/seed.js
// WARNING: This will NOT delete existing data. It checks for duplicates.
// To reset completely: pass --reset flag: node scripts/seed.js --reset

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

// Import models
const Problem = require('../models/problem');
const User = require('../models/user');
const Submission = require('../models/submission');

// ═══════════════════════════════════════════════════════════
//  PROBLEM DATA — 10 classic competitive programming problems
// ═══════════════════════════════════════════════════════════

const PROBLEMS = [
  // ──────────── PROBLEM 1 — Two Sum (Easy) ────────────
  {
    title: 'Two Sum',
    description: `Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

**Input Format:**
- First line: n (size of array)
- Second line: n space-separated integers
- Third line: target integer

**Output Format:**
- Two space-separated indices`,
    input: '4\n2 7 11 15\n9',
    output: '0 1',
    difficulty: 1,
    tags: ['Array', 'Hash Map', 'Two Pointers'],
    hiddenTestCases: [
      { input: '4\n2 7 11 15\n9', output: '0 1' },
      { input: '3\n3 2 4\n6', output: '1 2' },
      { input: '2\n3 3\n6', output: '0 1' },
      { input: '5\n1 2 3 4 5\n9', output: '3 4' },
      { input: '1\n0\n0', output: '0 0' },
      { input: '6\n-1 -2 -3 -4 -5 -6\n-7', output: '2 3' },
      { input: '4\n0 4 3 0\n0', output: '0 3' },
    ],
  },

  // ──────────── PROBLEM 2 — Valid Parentheses (Easy) ────────────
  {
    title: 'Valid Parentheses',
    description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
- Open brackets must be closed by the same type of brackets.
- Open brackets must be closed in the correct order.
- Every close bracket has a corresponding open bracket of the same type.

**Input Format:**
- A single string of brackets

**Output Format:**
- "true" or "false"`,
    input: '()',
    output: 'true',
    difficulty: 1,
    tags: ['Stack', 'String'],
    hiddenTestCases: [
      { input: '()', output: 'true' },
      { input: '()[]{}', output: 'true' },
      { input: '(]', output: 'false' },
      { input: '([)]', output: 'false' },
      { input: '{[]}', output: 'true' },
      { input: ' ', output: 'true' },
    ],
  },

  // ──────────── PROBLEM 3 — Reverse Linked List (Easy) ────────────
  {
    title: 'Reverse Linked List',
    description: `Given the head of a singly linked list represented as space-separated integers (first number is the count), reverse the list and print the reversed values space-separated.

Example: Input "5\\n1 2 3 4 5" means a list of 5 nodes: 1->2->3->4->5
Output should be: "5 4 3 2 1"

**Input Format:**
- First line: n (number of nodes)
- Second line: n space-separated node values

**Output Format:**
- Space-separated reversed values`,
    input: '5\n1 2 3 4 5',
    output: '5 4 3 2 1',
    difficulty: 1,
    tags: ['Linked List', 'Recursion'],
    hiddenTestCases: [
      { input: '5\n1 2 3 4 5', output: '5 4 3 2 1' },
      { input: '2\n1 2', output: '2 1' },
      { input: '1\n1', output: '1' },
      { input: '4\n1 1 1 1', output: '1 1 1 1' },
      { input: '6\n10 20 30 40 50 60', output: '60 50 40 30 20 10' },
    ],
  },

  // ──────────── PROBLEM 4 — Maximum Subarray (Medium) ────────────
  {
    title: 'Maximum Subarray',
    description: `Given an integer array nums, find the subarray with the largest sum, and return its sum. (Kadane's Algorithm)

**Input Format:**
- First line: n (array size)
- Second line: n space-separated integers

**Output Format:**
- A single integer — the maximum subarray sum`,
    input: '9\n-2 1 -3 4 -1 2 1 -5 4',
    output: '6',
    difficulty: 2,
    tags: ['Array', 'Dynamic Programming', 'Divide and Conquer'],
    hiddenTestCases: [
      { input: '9\n-2 1 -3 4 -1 2 1 -5 4', output: '6' },
      { input: '1\n1', output: '1' },
      { input: '1\n-1', output: '-1' },
      { input: '5\n5 4 -1 7 8', output: '23' },
      { input: '4\n-2 -1 -3 -4', output: '-1' },
      { input: '6\n1 -1 1 -1 1 -1', output: '1' },
    ],
  },

  // ──────────── PROBLEM 5 — Binary Search (Easy) ────────────
  {
    title: 'Binary Search',
    description: `Given a sorted array of distinct integers and a target value, return the index if the target is found. If not, return -1.

You must write an algorithm with O(log n) runtime complexity.

**Input Format:**
- First line: n (array size)
- Second line: n sorted space-separated integers
- Third line: target integer

**Output Format:**
- Index of target, or -1 if not found`,
    input: '6\n-1 0 3 5 9 12\n9',
    output: '4',
    difficulty: 1,
    tags: ['Array', 'Binary Search'],
    hiddenTestCases: [
      { input: '6\n-1 0 3 5 9 12\n9', output: '4' },
      { input: '6\n-1 0 3 5 9 12\n2', output: '-1' },
      { input: '1\n5\n5', output: '0' },
      { input: '1\n5\n6', output: '-1' },
      { input: '5\n1 3 5 7 9\n7', output: '3' },
    ],
  },

  // ──────────── PROBLEM 6 — Climbing Stairs (Easy) ────────────
  {
    title: 'Climbing Stairs',
    description: `You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?

**Input Format:**
- A single integer n

**Output Format:**
- A single integer — the number of distinct ways`,
    input: '3',
    output: '3',
    difficulty: 1,
    tags: ['Dynamic Programming', 'Math', 'Memoization'],
    hiddenTestCases: [
      { input: '1', output: '1' },
      { input: '2', output: '2' },
      { input: '3', output: '3' },
      { input: '5', output: '8' },
      { input: '10', output: '89' },
    ],
  },

  // ──────────── PROBLEM 7 — Merge Intervals (Medium) ────────────
  {
    title: 'Merge Intervals',
    description: `Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

**Input Format:**
- First line: n (number of intervals)
- Next n lines: each line has two integers (start end)

**Output Format:**
- Merged intervals, one per line, space-separated`,
    input: '4\n1 3\n2 6\n8 10\n15 18',
    output: '1 6\n8 10\n15 18',
    difficulty: 2,
    tags: ['Array', 'Sorting', 'Greedy'],
    hiddenTestCases: [
      { input: '4\n1 3\n2 6\n8 10\n15 18', output: '1 6\n8 10\n15 18' },
      { input: '2\n1 4\n4 5', output: '1 5' },
      { input: '1\n1 1', output: '1 1' },
      { input: '3\n1 4\n2 3\n3 5', output: '1 5' },
    ],
  },

  // ──────────── PROBLEM 8 — Word Search (Hard) ────────────
  {
    title: 'Word Search',
    description: `Given an m x n grid of characters board and a string word, return true if word exists in the grid, otherwise false.

The word can be constructed from letters of sequentially adjacent cells, where adjacent cells are horizontally or vertically neighboring. The same letter cell may not be used more than once.

**Input Format:**
- First line: m n (grid dimensions)
- Next m lines: each line has n characters space-separated
- Last line: the target word

**Output Format:**
- "true" or "false"`,
    input: '3 4\nA B C E\nS F C S\nA D E E\nABCCED',
    output: 'true',
    difficulty: 3,
    tags: ['Array', 'Backtracking', 'DFS', 'Matrix'],
    hiddenTestCases: [
      { input: '3 4\nA B C E\nS F C S\nA D E E\nABCCED', output: 'true' },
      { input: '3 4\nA B C E\nS F C S\nA D E E\nSEE', output: 'true' },
      { input: '3 4\nA B C E\nS F C S\nA D E E\nABCB', output: 'false' },
      { input: '1 1\nA\nA', output: 'true' },
    ],
  },

  // ──────────── PROBLEM 9 — LRU Cache (Hard) ────────────
  {
    title: 'LRU Cache',
    description: `Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.

Implement get and put operations:
- get(key): Return the value if the key exists, otherwise return -1.
- put(key, value): Update or insert. When the cache reaches capacity, evict the least recently used key.

**Input Format:**
- First line: capacity
- Second line: number of operations q
- Next q lines: either "get key" or "put key value"

**Output Format:**
- For each get operation: print the value (-1 if not found)
- For put operations: no output`,
    input: '2\n9\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2\nput 4 4\nget 1\nget 3\nget 4',
    output: '1\n-1\n-1\n3\n4',
    difficulty: 3,
    tags: ['Hash Map', 'Linked List', 'Design'],
    hiddenTestCases: [
      { input: '2\n9\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2\nput 4 4\nget 1\nget 3\nget 4', output: '1\n-1\n-1\n3\n4' },
      { input: '1\n5\nput 1 10\nget 1\nput 2 20\nget 1\nget 2', output: '10\n-1\n20' },
      { input: '3\n7\nput 1 1\nput 2 2\nput 3 3\nget 1\nput 4 4\nget 2\nget 3', output: '1\n-1\n3' },
    ],
  },

  // ──────────── PROBLEM 10 — Number of Islands (Medium) ────────────
  {
    title: 'Number of Islands',
    description: `Given an m x n 2D binary grid which represents a map of '1's (land) and '0's (water), return the number of islands.

An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.

**Input Format:**
- First line: m n (grid dimensions)
- Next m lines: each line has n characters (1 or 0) space-separated

**Output Format:**
- A single integer — the number of islands`,
    input: '4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0',
    output: '1',
    difficulty: 2,
    tags: ['BFS', 'DFS', 'Union Find', 'Matrix'],
    hiddenTestCases: [
      { input: '4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0', output: '1' },
      { input: '4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1', output: '3' },
      { input: '1 1\n1', output: '1' },
      { input: '1 1\n0', output: '0' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
//  DEMO USERS
// ═══════════════════════════════════════════════════════════

const DEMO_USERS = [
  {
    firstname: 'Admin',
    lastname: 'Judge',
    email: 'admin@codearena.dev',
    password: 'Admin@123456',
    role: 'admin',
    solvedTitles: [],
  },
  {
    firstname: 'Arjun',
    lastname: 'Sharma',
    email: 'arjun@codearena.dev',
    password: 'Demo@123456',
    role: 'user',
    solvedTitles: ['Two Sum', 'Valid Parentheses', 'Binary Search', 'Climbing Stairs', 'Reverse Linked List'],
  },
  {
    firstname: 'Priya',
    lastname: 'Patel',
    email: 'priya@codearena.dev',
    password: 'Demo@123456',
    role: 'user',
    solvedTitles: ['Two Sum', 'Maximum Subarray', 'Number of Islands'],
  },
  {
    firstname: 'Rahul',
    lastname: 'Verma',
    email: 'rahul@codearena.dev',
    password: 'Demo@123456',
    role: 'user',
    solvedTitles: ['Two Sum'],
  },
];

// ═══════════════════════════════════════════════════════════
//  REAL SOLUTION CODE for accepted submissions
// ═══════════════════════════════════════════════════════════

const SOLUTIONS = {
  'Two Sum': {
    cpp: `#include<bits/stdc++.h>
using namespace std;
int main(){
  int n; cin>>n;
  vector<int> a(n);
  for(auto&x:a) cin>>x;
  int t; cin>>t;
  map<int,int> mp;
  for(int i=0;i<n;i++){
    if(mp.count(t-a[i])){cout<<mp[t-a[i]]<<" "<<i;return 0;}
    mp[a[i]]=i;
  }
  return 0;
}`,
    python: `n = int(input())
nums = list(map(int, input().split()))
target = int(input())
seen = {}
for i, x in enumerate(nums):
    if target - x in seen:
        print(seen[target - x], i)
        break
    seen[x] = i`,
  },

  'Valid Parentheses': {
    cpp: `#include<bits/stdc++.h>
using namespace std;
int main(){
  string s; getline(cin,s);
  stack<char> st;
  for(char c:s){
    if(c=='('||c=='['||c=='{') st.push(c);
    else{
      if(st.empty()) {cout<<"false";return 0;}
      char t=st.top(); st.pop();
      if((c==')'&&t!='(')||(c==']'&&t!='[')||(c=='}'&&t!='{'))
        {cout<<"false";return 0;}
    }
  }
  cout<<(st.empty()?"true":"false");
}`,
    python: `s = input()
stack = []
pairs = {')': '(', ']': '[', '}': '{'}
for c in s:
    if c in '([{':
        stack.append(c)
    elif c in ')]}':
        if not stack or stack[-1] != pairs[c]:
            print("false"); exit()
        stack.pop()
print("true" if not stack else "false")`,
  },

  'Reverse Linked List': {
    cpp: `#include<bits/stdc++.h>
using namespace std;
int main(){
  int n; cin>>n;
  vector<int> v(n);
  for(auto&x:v) cin>>x;
  for(int i=n-1;i>=0;i--){
    if(i<n-1) cout<<" ";
    cout<<v[i];
  }
  return 0;
}`,
    python: `n = int(input())
nums = list(map(int, input().split()))
print(' '.join(map(str, reversed(nums))))`,
  },

  'Maximum Subarray': {
    cpp: `#include<bits/stdc++.h>
using namespace std;
int main(){
  int n; cin>>n;
  vector<int> a(n);
  for(auto&x:a) cin>>x;
  int maxSum=a[0], cur=a[0];
  for(int i=1;i<n;i++){
    cur=max(a[i],cur+a[i]);
    maxSum=max(maxSum,cur);
  }
  cout<<maxSum;
}`,
    python: `n = int(input())
nums = list(map(int, input().split()))
max_sum = cur = nums[0]
for x in nums[1:]:
    cur = max(x, cur + x)
    max_sum = max(max_sum, cur)
print(max_sum)`,
  },

  'Binary Search': {
    cpp: `#include<bits/stdc++.h>
using namespace std;
int main(){
  int n; cin>>n;
  vector<int> a(n);
  for(auto&x:a) cin>>x;
  int t; cin>>t;
  int lo=0,hi=n-1;
  while(lo<=hi){
    int mid=(lo+hi)/2;
    if(a[mid]==t){cout<<mid;return 0;}
    if(a[mid]<t) lo=mid+1;
    else hi=mid-1;
  }
  cout<<-1;
}`,
  },

  'Climbing Stairs': {
    python: `n = int(input())
if n <= 2:
    print(n)
else:
    a, b = 1, 2
    for _ in range(n - 2):
        a, b = b, a + b
    print(b)`,
  },

  'Number of Islands': {
    cpp: `#include<bits/stdc++.h>
using namespace std;
int m,n;
vector<vector<int>> grid;
void dfs(int i,int j){
  if(i<0||i>=m||j<0||j>=n||grid[i][j]==0) return;
  grid[i][j]=0;
  dfs(i+1,j); dfs(i-1,j); dfs(i,j+1); dfs(i,j-1);
}
int main(){
  cin>>m>>n;
  grid.assign(m,vector<int>(n));
  for(auto&r:grid) for(auto&x:r) cin>>x;
  int cnt=0;
  for(int i=0;i<m;i++) for(int j=0;j<n;j++)
    if(grid[i][j]==1){cnt++;dfs(i,j);}
  cout<<cnt;
}`,
  },
};

// Intentionally wrong code for WA submissions
const WRONG_CODE = {
  'Maximum Subarray': {
    cpp: `#include<bits/stdc++.h>
using namespace std;
int main(){
  int n; cin>>n;
  vector<int> a(n);
  for(auto&x:a) cin>>x;
  // Bug: just sums entire array instead of finding max subarray
  int sum=0;
  for(int x:a) sum+=x;
  cout<<sum;
}`,
    python: `n = int(input())
nums = list(map(int, input().split()))
# Bug: returns max element instead of max subarray sum
print(max(nums))`,
  },

  'Two Sum': {
    cpp: `#include<bits/stdc++.h>
using namespace std;
int main(){
  // Bug: always outputs 0 0
  int n; cin>>n;
  cout<<"0 0";
}`,
  },
};

// Compile error code
const COMPILE_ERROR_CODE = {
  cpp: `#include<bits/stdc++.h>
using namespace std;
int main(){
  // Missing semicolon
  cout << "hello"
  return 0;
}`,
  python: `# IndentationError
def solve():
print("hello")
solve()`,
};

// ═══════════════════════════════════════════════════════════
//  MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════

async function main() {
  const isReset = process.argv.includes('--reset');

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Online Judge — Database Seeder');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // Connect to MongoDB
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online-judge';
  console.log(`Connecting to: ${uri.replace(/\/\/.*@/, '//***@')}`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('✅ Connected to MongoDB\n');

  // ── Reset mode ──
  if (isReset) {
    console.log('⚠️  RESET MODE — dropping existing data...');
    await Problem.deleteMany({});
    await Submission.deleteMany({});
    // Delete demo users but keep any real users
    await User.deleteMany({
      email: { $in: DEMO_USERS.map((u) => u.email) },
    });
    console.log('   Cleared problems, submissions, and demo users.\n');
  }

  // ── Step 1: Seed Problems ──
  console.log('📝 Seeding problems...');
  let problemsCreated = 0;
  const problemMap = {}; // title -> ObjectId

  for (const prob of PROBLEMS) {
    const existing = await Problem.findOne({ title: prob.title });
    if (existing) {
      console.log(`   ⏭  "${prob.title}" already exists`);
      problemMap[prob.title] = existing._id;
    } else {
      const created = await Problem.create(prob);
      problemMap[prob.title] = created._id;
      problemsCreated++;
      const diffLabel = ['', 'Easy', 'Medium', 'Hard'][prob.difficulty];
      console.log(`   ✅ Created: "${prob.title}" (${diffLabel})`);
    }
  }
  console.log(`   → ${problemsCreated} problems created\n`);

  // ── Step 2: Seed Users ──
  console.log('👤 Seeding users...');
  let usersCreated = 0;
  const userMap = {}; // email -> { _id, solvedTitles }

  for (const userData of DEMO_USERS) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      console.log(`   ⏭  ${userData.email} already exists`);
      userMap[userData.email] = { _id: existing._id, solvedTitles: userData.solvedTitles };
    } else {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const solvedIds = userData.solvedTitles.map((t) => problemMap[t]).filter(Boolean);

      const user = await User.create({
        firstname: userData.firstname,
        lastname: userData.lastname,
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
        solvedProblems: solvedIds,
      });

      userMap[userData.email] = { _id: user._id, solvedTitles: userData.solvedTitles };
      usersCreated++;
      console.log(`   ✅ Created: ${userData.firstname} ${userData.lastname} (${userData.role}) — ${solvedIds.length} solved`);
    }
  }
  console.log(`   → ${usersCreated} users created\n`);

  // ── Step 3: Seed Submissions ──
  console.log('📊 Seeding submissions...');
  let submissionsCreated = 0;

  // Helper: random date within last 30 days
  const randomDate = () => {
    const now = Date.now();
    const daysAgo = Math.floor(Math.random() * 30);
    const hoursAgo = Math.floor(Math.random() * 24);
    return new Date(now - daysAgo * 86400000 - hoursAgo * 3600000);
  };

  // Helper: create a submission
  const createSub = async (email, title, verdict, lang, code) => {
    const userId = userMap[email]?._id;
    const problemId = problemMap[title];
    if (!userId || !problemId) return;

    // Check for duplicate
    const existing = await Submission.findOne({ userId, problemId, verdict });
    if (existing) return;

    await Submission.create({
      userId,
      problemId,
      language: lang,
      code,
      verdict,
      createdAt: randomDate(),
    });
    submissionsCreated++;
  };

  // ── Arjun: 5 accepted + 3 wrong on Maximum Subarray ──
  const arjun = 'arjun@codearena.dev';
  await createSub(arjun, 'Two Sum', '✅ Accepted', 'cpp', SOLUTIONS['Two Sum'].cpp);
  await createSub(arjun, 'Valid Parentheses', '✅ Accepted', 'cpp', SOLUTIONS['Valid Parentheses'].cpp);
  await createSub(arjun, 'Binary Search', '✅ Accepted', 'cpp', SOLUTIONS['Binary Search'].cpp);
  await createSub(arjun, 'Climbing Stairs', '✅ Accepted', 'python', SOLUTIONS['Climbing Stairs'].python);
  await createSub(arjun, 'Reverse Linked List', '✅ Accepted', 'python', SOLUTIONS['Reverse Linked List'].python);

  // 3 wrong attempts on Maximum Subarray
  for (let i = 0; i < 3; i++) {
    await createSub(arjun, 'Maximum Subarray', '❌ Wrong Answer', i % 2 === 0 ? 'cpp' : 'python',
      i % 2 === 0 ? WRONG_CODE['Maximum Subarray'].cpp : WRONG_CODE['Maximum Subarray'].python);
  }

  // ── Priya: 3 accepted + 2 compile error ──
  const priya = 'priya@codearena.dev';
  await createSub(priya, 'Two Sum', '✅ Accepted', 'python', SOLUTIONS['Two Sum'].python);
  await createSub(priya, 'Maximum Subarray', '✅ Accepted', 'python', SOLUTIONS['Maximum Subarray'].python);
  await createSub(priya, 'Number of Islands', '✅ Accepted', 'cpp', SOLUTIONS['Number of Islands'].cpp);

  // 2 compile error submissions
  await createSub(priya, 'Binary Search', '❌ Compile Error:\nmissing semicolon', 'cpp', COMPILE_ERROR_CODE.cpp);
  await createSub(priya, 'Climbing Stairs', '❌ Compile Error:\nIndentationError', 'python', COMPILE_ERROR_CODE.python);

  // ── Rahul: 1 accepted + 4 wrong ──
  const rahul = 'rahul@codearena.dev';
  await createSub(rahul, 'Two Sum', '✅ Accepted', 'cpp', SOLUTIONS['Two Sum'].cpp);

  for (let i = 0; i < 4; i++) {
    await createSub(rahul, 'Maximum Subarray', '❌ Wrong Answer', 'cpp', WRONG_CODE['Maximum Subarray'].cpp);
    await createSub(rahul, 'Valid Parentheses', '❌ Wrong Answer', 'cpp', WRONG_CODE['Two Sum'].cpp);
  }

  console.log(`   → ${submissionsCreated} submissions created\n`);

  // ── Final Summary ──
  console.log('═══════════════════════════════════════════════');
  console.log('  SEED COMPLETE');
  console.log('═══════════════════════════════════════════════');
  console.log(`Problems created:     ${problemsCreated}`);
  console.log(`Users created:        ${usersCreated}`);
  console.log(`Submissions created:  ${submissionsCreated}`);
  console.log('');
  console.log('Demo credentials:');
  console.log('  Admin:  admin@codearena.dev / Admin@123456');
  console.log('  User 1: arjun@codearena.dev / Demo@123456');
  console.log('  User 2: priya@codearena.dev / Demo@123456');
  console.log('  User 3: rahul@codearena.dev / Demo@123456');
  console.log('');
  console.log('Your app is ready to demo!');
  console.log('═══════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\n❌ Seed failed:', err.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
