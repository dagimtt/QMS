import Service from "../models/Service.js";
import Counter from "../models/Counter.js";

export const getServices = async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = {};
    
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const services = await Service.find(query)
      .populate('createdBy', 'fullName email');
    
    res.json({ success: true, services });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ message: 'Failed to get services' });
  }
};

export const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('createdBy', 'fullName email');
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Get counters that offer this service
    const counters = await Counter.find({ services: service._id, isActive: true })
      .populate('group')
      .populate('assignedUser', 'fullName');
    
    res.json({ 
      success: true, 
      service,
      assignedCounters: counters
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ message: 'Failed to get service' });
  }
};

export const createService = async (req, res) => {
  try {
    const { name, code, description, workflowPath, estimatedTime } = req.body;
    
    // Check if service exists
    const existingService = await Service.findOne({ $or: [{ name }, { code }] });
    if (existingService) {
      return res.status(400).json({ message: 'Service name or code already exists' });
    }
    
    const service = new Service({
      name,
      code: code.toUpperCase(),
      description,
      workflowPath: workflowPath || ['Verification', 'Payment', 'Validation', 'Authorization'],
      estimatedTime,
      createdBy: req.user._id
    });
    
    await service.save();
    
    const populatedService = await Service.findById(service._id)
      .populate('createdBy', 'fullName email');
    
    res.status(201).json({ success: true, service: populatedService });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ message: 'Failed to create service' });
  }
};

export const updateService = async (req, res) => {
  try {
    const { name, code, description, workflowPath, estimatedTime, isActive } = req.body;
    
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    if (name) service.name = name;
    if (code) service.code = code.toUpperCase();
    if (description !== undefined) service.description = description;
    if (workflowPath) service.workflowPath = workflowPath;
    if (estimatedTime !== undefined) service.estimatedTime = estimatedTime;
    if (isActive !== undefined) service.isActive = isActive;
    
    await service.save();
    
    const updatedService = await Service.findById(service._id)
      .populate('createdBy', 'fullName email');
    
    res.json({ success: true, service: updatedService });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ message: 'Failed to update service' });
  }
};

export const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Check if service is assigned to any counter
    const countersWithService = await Counter.find({ services: service._id });
    if (countersWithService.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete service that is assigned to counters. Remove service from counters first.' 
      });
    }
    
    await service.deleteOne();
    
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ message: 'Failed to delete service' });
  }
};

export const getServiceWorkflow = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    // Get counters for each step
    const workflowWithCounters = await Promise.all(
      service.workflowPath.map(async (step) => {
        const counters = await Counter.find({ 
          services: service._id, 
          type: step,
          isActive: true 
        }).populate('group');
        
        return {
          step,
          availableCounters: counters,
          totalCounters: counters.length
        };
      })
    );
    
    res.json({ 
      success: true, 
      workflow: workflowWithCounters,
      estimatedTime: service.estimatedTime
    });
  } catch (error) {
    console.error('Get service workflow error:', error);
    res.status(500).json({ message: 'Failed to get service workflow' });
  }
};