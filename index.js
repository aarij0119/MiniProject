const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const cookieparser = require('cookie-parser');
const multer = require('multer');
const crypto = require('crypto');

const userModel = require('./models/usermodel');
const userPost = require('./models/postmodel')

app.set("view engine", 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieparser())

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', function (req, res) {
    res.render('index')
});

app.post('/register', async function (req, res) {
    const { username, name, email, age, password } = req.body;
    const user = await userModel.findOne({ email });
    if (user) return res.status(400).send("user already exist")
    bcrypt.genSalt(10, function (err, salt) {
        bcrypt.hash(password, salt, async function (err, hash) {
            const user = await userModel.create({
                username,
                name,
                email,
                age,
                password: hash
            });
            const token = jwt.sign({ email: user.email, userid: user._id }, "hello");
            res.cookie('token', token);
            res.redirect('/profile');
        });

    });
});
app.get('/logout', function (req, res) {
    res.cookie('token', "")
    res.redirect('/login')
    // console.log("Logout succesfully")
});

app.get('/login', function (req, res) {
    res.render('login')
});

app.post('/login', async function (req, res) {
    const { username, email, password } = req.body;
    const user = await userModel.findOne({ email });
    // console.log("Login user this", user)
    if (!user) return res.status(400).send("Something went wrong");
    bcrypt.compare(password, user.password, function (err, result) {
        // res.send("console dekho")
        if (result) {
            const token = jwt.sign({ email: user.email, userid: user._id }, "hello");
            res.cookie('token', token);
            res.status(200).redirect('/profile')
        } else {
            res.send("Sorry somethig went wromg");
        }
    });

});

app.get('/profile', isloggedin, async function (req, res) {
    const user = await userModel.findOne({ _id: req.user.userid });
    //  console.log("profile user is this",user)
    await user.populate("posts")
    res.render('profile', { user })
});

function isloggedin(req, res, next) {
    if (req.cookies.token == "") {
        res.send("you must be loggedin")
    } else {
        const data = jwt.verify(req.cookies.token, "hello");
        req.user = data
        //   console.log("Data is ", data)
    }
    next()
};


app.post('/post', isloggedin, async function (req, res) {
    const user = await userModel.findOne({ email: req.user.email })
    //  console.log("loging user is ", user.username)
    const userpost = await userPost.create({
        user: user._id,
        postadata: req.body.textarea,
    });
    // console.log(userpost)
    user.posts.push(userpost._id)
    await user.save()
    res.redirect('/profile')

});
app.get('/like/:id', isloggedin, async function (req, res) {
    const post = await userPost.findOne({ _id: req.params.id }).populate("user");
    //   console.log("Posttt",post)
    if (post.likes.indexOf(req.user.userid) === -1) {
        post.likes.push(req.user.userid)
    } else {
        post.likes.splice(post.likes.indexOf(req.user.userid), 1)
    }
    //   console.log(post.likes.push(post.user))
    await post.save()
    res.redirect('/profile')
});

app.get('/edit/:id', isloggedin, async function (req, res) {
    const post = await userPost.findOne({ _id: req.params.id }).populate("user")
    res.render('edit', { post })
    // console.log(post)
});
app.post('/update/:id', isloggedin, async function (req, res) {
    const post = await userPost.findOneAndUpdate({ _id: req.params.id }, { postadata: req.body.textedit }).populate("user")
    res.redirect('/profile')
    // console.log(post)
});

app.get('/file', function (req, res) {
    res.render('file')
});
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/image/uploads')
    },
    filename: function (req, file, cb) {
        crypto.randomBytes(12, function (err, bytes) {
            const fn = bytes.toString("hex") + path.extname(file.originalname)
            cb(null, fn)
        })
    }
})

const upload = multer({ storage: storage });

app.post('/upload', upload.single('image'), isloggedin, async function (req, res) {
    const user = await userModel.findOne({ email: req.user.email });
    user.profile = req.file.filename
    await user.save()
    res.redirect('/profile')
});

app.listen(3000)    