import { Schema, model } from "mongoose";
const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    avatar: {
        type: String,
        default: "",
    },
    created: {
        type: Date,
        default: Date.now,
    },
});
export default model("User", UserSchema);
//# sourceMappingURL=User.js.map