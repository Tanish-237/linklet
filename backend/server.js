import 'dotenv/config';
import express from 'express';
const app = express();
import {router as userRouter} from './router/user-routes.js';
import {router as postRouter} from './router/post-routes.js';
import {connectDb} from './utils/db.js';
import cookieParser from 'cookie-parser';
import {User} from './models/users.js';
import cors from 'cors';  
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
import bcrypt from 'bcryptjs';


// Middleware for serving static files
app.use(express.static('public'));

app.use(express.urlencoded({extended: true})); 
app.use(express.json()) 
app.use(cookieParser());


app.use('/', userRouter);
app.use('/', postRouter);

const PORT = 3000;

connectDb().then(()=>{
    app.listen(PORT, (req, res)=>{
        console.log(`Server is running on port ${PORT}`);
    })
})
