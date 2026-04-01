import mongoose from "mongoose";
import dotenv from "dotenv";
import Counter from "../models/Counter.js";
import Zone from "../models/Zone.js";
import Group from "../models/Group.js";
import Ticket from "../models/Ticket.js";

dotenv.config();

const resetCounters = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qms');
    console.log('✅ Connected to MongoDB\n');
    
    // Find zone-2
    const zone = await Zone.findOne({ name: "zone-2" });
    if (!zone) {
      console.log('❌ Zone-2 not found');
      process.exit(1);
    }
    
    console.log('📍 Zone:', zone.name);
    
    // Find groups in zone
    const groups = await Group.find({ zone: zone._id });
    const groupIds = groups.map(g => g._id);
    
    console.log(`📋 Groups in zone: ${groups.length}`);
    
    // Reset all counters in this zone
    const resetResult = await Counter.updateMany(
      { group: { $in: groupIds } },
      { 
        $set: { 
          status: "Available", 
          currentTicket: null,
          queue: []
        } 
      }
    );
    
    console.log(`\n🔄 Reset ${resetResult.modifiedCount} counters to Available status`);
    
    // Reset any stuck tickets
    const ticketReset = await Ticket.updateMany(
      { 
        zone: zone._id,
        status: "Serving"
      },
      { 
        $set: { 
          status: "Waiting",
          calledAt: null
        } 
      }
    );
    
    console.log(`🔄 Reset ${ticketReset.modifiedCount} stuck tickets to Waiting status`);
    
    // Show final counter status
    const updatedCounters = await Counter.find({ group: { $in: groupIds } });
    console.log('\n📊 Final Counter Status:');
    updatedCounters.forEach(c => {
      console.log(`   ${c.counterNumber} (${c.type}) - Status: ${c.status}`);
    });
    
    console.log('\n✅ All counters in zone-2 are now available!');
    console.log('\n💡 You can now call tickets normally.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

resetCounters();