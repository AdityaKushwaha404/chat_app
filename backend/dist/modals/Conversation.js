import { Schema, model } from "mongoose";
const ConversationSchema = new Schema({
    type: {
        type: String,
        enum: ["direct", "group"],
        required: true,
    },
    name: String,
    participants: [
        {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    ],
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: "Message",
    },
    avatar: {
        type: String,
        default: "",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });
ConversationSchema.pre("save", function (next) {
    // @ts-ignore
    this.updatedAt = new Date();
    if (typeof next === "function")
        next();
});
export default model("Conversation", ConversationSchema);
//# sourceMappingURL=Conversation.js.map