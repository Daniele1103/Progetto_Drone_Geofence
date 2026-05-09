import app from './app.js';
import dotenv from 'dotenv';
import path from "path";

dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});