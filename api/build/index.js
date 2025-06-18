"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.continuumApi = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_jwt_1 = require("express-jwt");
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
// Import routers
const projects_1 = __importDefault(require("./routes/projects"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// --- Authentication Middleware ---
const requireAuth = (0, express_jwt_1.expressjwt)({
    secret: jwks_rsa_1.default.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co/auth/v1/jwks`,
    }),
    audience: 'authenticated',
    issuer: `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co/auth/v1`,
    algorithms: ['RS256'],
});
// --- API Routes ---
const apiRouter = express_1.default.Router();
apiRouter.use(requireAuth);
apiRouter.use('/projects', projects_1.default);
app.use('/api', apiRouter);
// For local development
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`API server listening on port ${port}`);
    });
}
exports.continuumApi = app;
