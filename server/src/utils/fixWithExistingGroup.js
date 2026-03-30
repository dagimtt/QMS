import mongoose from "mongoose";
import dotenv from "dotenv";
import Zone from "../models/Zone.js";
import Group from "../models/Group.js";
import Counter from "../models/Counter.js";
import Service from "../models/Service.js";

dotenv.config();

const fixWithExistingGroup = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qms');
    console.log('✅ Connected to MongoDB\n');
    
    // 1. Get your existing group
    const groupId = "69cac89f81245251bacfe82e";
    const group = await Group.findById(groupId);
    
    if (!group) {
      console.log('❌ Group not found!');
      process.exit(1);
    }
    
    console.log('✅ Found group:', group.name);
    console.log('   Group ID:', group._id);
    console.log('   Zone ID:', group.zone);
    
    // 2. Get zone
    let zone = await Zone.findById(group.zone);
    if (!zone) {
      console.log('⚠️ Zone not found for group, creating zone...');
      zone = new Zone({
        name: "Main Hall",
        code: "MAIN",
        description: "Main service area",
        isActive: true,
        groups: [group._id]
      });
      await zone.save();
      console.log('✅ Created zone:', zone.name);
      
      // Update group with zone
      group.zone = zone._id;
      await group.save();
      console.log('✅ Updated group with zone');
    } else {
      console.log('✅ Zone found:', zone.name);
    }
    
    // 3. Get service
    let service = await Service.findOne({ code: "DOC" });
    if (!service) {
      console.log('⚠️ Service not found, creating default service...');
      service = new Service({
        name: "Document Verification",
        code: "DOC",
        description: "Verify customer documents",
        workflowPath: ["Verification", "Validation", "Authorization"],
        estimatedTime: 10,
        category: "Regular",
        isActive: true
      });
      await service.save();
      console.log('✅ Created service:', service.name);
    } else {
      console.log('✅ Service found:', service.name);
    }
    console.log('   Service ID:', service._id);
    
    // 4. Get or create counter
    let counter = await Counter.findById("69cac8f681245251bacfe883");
    
    if (!counter) {
      console.log('⚠️ Counter not found, creating new counter...');
      counter = new Counter({
        counterNumber: "001",
        name: "Window 1",
        type: "Verifier",
        group: group._id,
        services: [service._id],
        isActive: true,
        status: "Available"
      });
      await counter.save();
      console.log('✅ Created counter:', counter.counterNumber);
    } else {
      console.log('✅ Counter found:', counter.counterNumber);
      console.log('   Current type:', counter.type);
      console.log('   Current status:', counter.status);
      console.log('   Current services:', counter.services);
      
      // Update counter to ensure it has the service
      if (!counter.services.some(s => s.toString() === service._id.toString())) {
        counter.services.push(service._id);
        await counter.save();
        console.log('✅ Added service to counter');
      }
      
      // Ensure counter type is Verifier
      if (counter.type !== "Verifier") {
        counter.type = "Verifier";
        await counter.save();
        console.log('✅ Updated counter type to Verifier');
      }
      
      // Ensure counter is available
      counter.status = "Available";
      counter.isActive = true;
      await counter.save();
      console.log('✅ Counter set to available');
    }
    
    // 5. Add counter to group if not already
    if (!group.counters.some(c => c.toString() === counter._id.toString())) {
      group.counters.push(counter._id);
      await group.save();
      console.log('✅ Added counter to group');
    }
    
    // 6. Add group to zone if not already
    if (!zone.groups.some(g => g.toString() === group._id.toString())) {
      zone.groups.push(group._id);
      await zone.save();
      console.log('✅ Added group to zone');
    }
    
    // 7. Update service workflowPath to match counter type mapping
    if (service.workflowPath && service.workflowPath.length > 0) {
      console.log('\n📋 Service workflow:', service.workflowPath);
      console.log('   First step:', service.workflowPath[0]);
      console.log('   Maps to counter type: Verifier ✓');
    }
    
    // 8. Verify everything
    console.log('\n========================================');
    console.log('🎉 FIX COMPLETED SUCCESSFULLY!');
    console.log('========================================');
    console.log('\n📋 System Configuration:');
    console.log(`Service: ${service.name} (${service.code})`);
    console.log(`  - ID: ${service._id}`);
    console.log(`  - First step: ${service.workflowPath?.[0] || 'Verification'}`);
    console.log(`\nZone: ${zone.name} (${zone.code})`);
    console.log(`  - ID: ${zone._id}`);
    console.log(`\nGroup: ${group.name} (${group.code})`);
    console.log(`  - ID: ${group._id}`);
    console.log(`  - Zone: ${zone.name}`);
    console.log(`\nCounter: ${counter.counterNumber} (${counter.name})`);
    console.log(`  - ID: ${counter._id}`);
    console.log(`  - Type: ${counter.type}`);
    console.log(`  - Status: ${counter.status}`);
    console.log(`  - Services: ${counter.services.length}`);
    console.log(`  - Group: ${group.name}`);
    
    console.log('\n💡 TEST TICKET CREATION:');
    console.log('Use this exact service ID in Postman:');
    console.log(`Service ID: ${service._id}`);
    console.log('\nPOST http://localhost:5000/api/tickets');
    console.log('Body:');
    console.log(`{`);
    console.log(`  "serviceId": "${service._id}",`);
    console.log(`  "customerName": "Test Customer",`);
    console.log(`  "customerPhone": "1234567890"`);
    console.log(`}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixWithExistingGroup();