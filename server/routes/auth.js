const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { access, refresh } = require('../services/tokenService');
const { authenticate } = require('../middleware/auth');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
router.post('/register', [body('displayName').trim().isLength({min:2,max:60}), body('email').isEmail().normalizeEmail(), body('password').isLength({min:8})], async (req,res) => {
  const errors=validationResult(req); if(!errors.isEmpty()) return res.status(400).json({message:'Invalid registration details',errors:errors.array()});
  try { const passwordHash=await bcrypt.hash(req.body.password,12); const user=await User.create({displayName:req.body.displayName,email:req.body.email,passwordHash}); const a=access(user.id), r=refresh(user.id); user.refreshTokenHash=hash(r); await user.save(); res.status(201).json({token:a,refreshToken:r,user:{id:user.id,displayName:user.displayName,email:user.email,role:user.role}}); }
  catch(e){res.status(409).json({message:e.code===11000?'Email already registered':'Could not register user'});}
});
router.post('/login', async(req,res)=>{const user=await User.findOne({email:String(req.body.email||'').toLowerCase()}); if(!user || !(await bcrypt.compare(req.body.password||'',user.passwordHash))) return res.status(401).json({message:'Invalid email or password'}); const a=access(user.id),r=refresh(user.id); user.refreshTokenHash=hash(r); await user.save(); res.json({token:a,refreshToken:r,user:{id:user.id,displayName:user.displayName,email:user.email,role:user.role}});});
router.post('/refresh', async(req,res)=>{try{const jwt=require('jsonwebtoken');const d=jwt.verify(req.body.refreshToken,process.env.JWT_REFRESH_SECRET);const user=await User.findById(d.id);if(!user||user.refreshTokenHash!==hash(req.body.refreshToken))return res.status(401).json({message:'Invalid refresh token'});const a=access(user.id),r=refresh(user.id);user.refreshTokenHash=hash(r);await user.save();res.json({token:a,refreshToken:r});}catch{return res.status(401).json({message:'Invalid refresh token'});}});
router.get('/me',authenticate,(req,res)=>res.json({user:req.user}));
module.exports=router;
