import mongoose, { Schema } from "mongoose";
import { User } from "../types";
import { Store, StoredBoard } from "./types";

const cardSchema = new Schema(
  { id: String, title: String, description: String, position: Number, version: Number, updatedAt: String },
  { _id: false }
);
const listSchema = new Schema(
  { id: String, title: String, position: Number, cards: [cardSchema] },
  { _id: false }
);
const boardSchema = new Schema({
  id: { type: String, unique: true, index: true },
  name: String,
  members: [{ _id: false, userId: { type: String, index: true }, role: String }],
  lists: [listSchema],
  createdAt: String,
  rev: Number,
});
const userSchema = new Schema({
  id: { type: String, unique: true },
  email: { type: String, unique: true, index: true },
  name: String,
  passwordHash: String,
});

const BoardModel = mongoose.model("Board", boardSchema);
const UserModel = mongoose.model("User", userSchema);

const strip = <T>(doc: any): T => {
  const { _id, __v, ...rest } = doc;
  return rest as T;
};

export class MongoStore implements Store {
  static async connect(url: string) {
    await mongoose.connect(url);
    return new MongoStore();
  }

  async createUser(user: User) {
    await UserModel.create(user);
  }
  async findUserByEmail(email: string) {
    const doc = await UserModel.findOne({ email }).lean();
    return doc ? strip<User>(doc) : null;
  }
  async findUserById(id: string) {
    const doc = await UserModel.findOne({ id }).lean();
    return doc ? strip<User>(doc) : null;
  }
  async createBoard(board: StoredBoard) {
    await BoardModel.create(board);
  }
  async getBoard(id: string) {
    const doc = await BoardModel.findOne({ id }).lean();
    return doc ? strip<StoredBoard>(doc) : null;
  }
  async listBoardsForUser(userId: string) {
    const docs = await BoardModel.find({ "members.userId": userId }).lean();
    return docs.map((d) => strip<StoredBoard>(d));
  }
  async saveBoard(board: StoredBoard, expectedRev: number) {
    const { rev, ...rest } = board;
    const res = await BoardModel.updateOne(
      { id: board.id, rev: expectedRev },
      { $set: { ...rest, rev: expectedRev + 1 } }
    );
    return res.modifiedCount === 1;
  }
  async deleteBoard(id: string) {
    await BoardModel.deleteOne({ id });
  }
}
