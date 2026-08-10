import {Schema,model} from "mongoose";
import bcrypt from "bcrypt";

const userSchema=new Schema({
 username:{
    type:String,
    required:true
 },
  email:{
    type:String,
    match:[/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,"please Enter Valid Email"],
    required:true,
    unique:true
  },
  password:{
    type:String,
    minLength:[4,"Minimum length of password must be 4 "],
  },
  role:{
    type:String,
    enum: [
    "User",
    "Hospital",
    "BloodBank",
    "DeliveryPartner",
    "Admin"
  ],  
    default:"User"
  },
  accountStatus: {
  type: String,
  enum: ["pending", "active", "rejected", "suspended"],
  default: "active"
},
  isDonor:{
    type:Boolean,
    default:false
  },

  phoneNumber: {
    type: String,
    trim: true,
  },

  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
  },

  dateOfBirth: {
    type: Date,
  },
  city: {
    type: String,
    trim: true,
  },
  district:{
   type: String,
    trim: true,
  },
    state: {
    type: String,
    trim: true,
  },
  short_address: {
    type: String,
    trim: true,
  },

  location: {
    type: {
        type: String,
        enum: ["Point"],
        default: "Point"
    },
    coordinates: {
        type: [Number], // [longitude, latitude]
        default:undefined
    }
},
lastLocationUpdatedAt:{
    type:Date,
},

picture:{
  type:String
},

authProvider:{
  type:String,
  enum:["local","google"],
  default:"local"
},

passwordResetToken: {
  type: String,
},

passwordResetExpires: {
  type: Date,
},

},{
    strict:"throw",
    versionKey:false,
    timestamps: true
});

userSchema.index({ location: "2dsphere" });

userSchema.pre("save",async function (){
  //* if password is not modified, skip hashing
  if(!this.isModified("password")) return;

  this.password=await bcrypt.hash(this.password,10);
})


const User=model("User",userSchema);
export default User;



