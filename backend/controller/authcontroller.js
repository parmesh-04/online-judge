const bcrypt = require('bcryptjs')
const User = require('../models/user')
const { createToken, setAuthCookie } = require('../utils/jwt');
const { isStrongPassword, isValidEmail } = require('../utils/validation');


const register= async (req,res) =>{
try{
    const { firstname, lastname, email, password } = req.body
     if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({ message: 'Firstname, lastname, email and password required' });
    }
    if (!String(firstname).trim() || !String(lastname).trim()) {
      return res.status(400).json({ message: 'Firstname and lastname required' });
    }
if(!isValidEmail(email)){
    return res.status(400).json({ message: 'Invalid email format' });
}
if(!isStrongPassword(password)){
    return res.status(400).json({message : "password must be 6+ chars with uppercase and number"})
}
 if (await User.findOne({ email :email })) {
      return res.status(400).json({ message: 'User already exists' });
    }

// Hash the password before saving so plain text is never stored
    const hashedPassword = await bcrypt.hash(password, 10);
// Create the user document in MongoDB
    const newUser = await User.create({
      firstname: String(firstname).trim(),
      lastname: String(lastname).trim(),
      email,
      password: hashedPassword,
      role: 'user'
    });
// Create JWT for the newly registered user
const token = createToken(newUser);
setAuthCookie(res,token)
// Send minimal safe user data back to the client
  res.status(201).json({ message: 'Registered successfully', user: { id: newUser._id, email: newUser.email } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}
// // //req.body   •200 → success •	401 → unauthorized •500 → server error •400→bad request                            
// req.params      
// req.query    
// req.headers
// req.cookies
const login = async (req,res) =>{
    try{
    const {email,password}= req.body
if (!email || !password) {
    // Client did not send required fields
    return res.status(400).json({ message: 'please enter complete details' });
  }
// Look up user by email
  const existingUser = await User.findOne({ email });
// If user not found or password is wrong
  if (!existingUser || !(await bcrypt.compare(password, existingUser.password))) {
    return res.status(401).json({ message: 'invalid credentials' });
  }
// Generate JWT for logged-in user
  const token = createToken(existingUser);
  setAuthCookie(res,token);

// Successful login response
  return res.status(200).json({ message: 'logged in successfully', email: existingUser.email });
   
}
catch(error){
    // Unexpected server error
    return res.status(500).json({ message: 'internal server error' });
}
}

// Clear auth cookie so user is logged out
const logout = (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out' });
};



module.exports = { register ,login ,logout}