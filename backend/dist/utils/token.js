import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
export const signToken = (user) => {
    const payload = {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
        },
    };
    // set token to expire in 30 days for longer sessions
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
};
export const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};
export default { signToken, verifyToken };
//# sourceMappingURL=token.js.map