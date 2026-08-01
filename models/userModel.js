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
  isDonor:{
    type:Boolean,
    default:false
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
  long_address:{
     type: String,
     trim: true,
  },
  coordinates: {
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
  },
  bloodGroup: {
    type: String,
    enum: [
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
        "Unknown"
    ],
    default: "Unknown"
},
picture:{
  type:String
}

},{
    strict:"throw",
    versionKey:false,
});

userSchema.pre("save",async function (){
  //* if password is not modified, skip hashing
  if(!this.isModified("password")) return;

  this.password=await bcrypt.hash(this.password,10);
})


const User=model("User",userSchema);
export default User;



