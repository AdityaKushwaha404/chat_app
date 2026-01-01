import { verifyToken } from "../utils/token.js";
export const requireAuth = (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization || req.cookies?.token || "";
        if (!authHeader)
            return next();
        let raw = authHeader;
        if (raw.startsWith("Bearer "))
            raw = raw.split(" ")[1];
        try {
            const payload = verifyToken(raw);
            if (payload && payload.user) {
                req.user = payload.user;
            }
        }
        catch (e) {
            // invalid token: ignore and continue as anonymous
        }
        return next();
    }
    catch (err) {
        return next();
    }
};
export default requireAuth;
//# sourceMappingURL=auth.middleware.js.map