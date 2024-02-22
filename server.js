const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    // Handle JSON syntax error
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(); // Pass the error to the next middleware
});

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/Depreciation')
  .then(() => {
    console.log('Connected to MongoDB database');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Terminate the application with a non-zero exit code
  });

// Define MongoDB Schema
const assetSchema = new mongoose.Schema({
  assetId: String,
  companyId: String,
  financialYear: String,
  month: Number,
  initialCost: Number,
  depreciationPercentage: Number,
  monthlyDepreciationCost: Number,
  totalDepreciatedCost: Number,
  mfd: Date, // Manufacturing date
  manufacturingYear: Number, // Manufacturing year
  manufacturingMonth: Number, // Manufacturing month
});

// Define the model using the schema
const Asset = mongoose.model('Asset', assetSchema);

// Endpoint to save asset data to MongoDB
app.post('/api/assets', async (req, res) => {
  try {
    const { assetId, companyId, financialYear, initialCost, depreciationPercentage, month, mfd } = req.body;

    if (!month && !mfd) {
      throw new Error('Please enter the month or manufacturing date (mfd)');
    }

    let monthsPassed;
    let startingMonth;

    if (mfd) {
      // Calculate the number of months since the manufacturing date
      monthsPassed = Math.floor((new Date() - new Date(mfd)) / (1000 * 60 * 60 * 24 * 30)); // Assuming 30 days per month
      startingMonth = 1;
    } else if (month >= 0) {
      // If month is greater than or equal to 0, consider months passed as the provided month
      monthsPassed = month - 1; // Adjusting to start counting from 1
      startingMonth = 1;
    } else {
      // If neither mfd nor month is provided, throw an error
      throw new Error('Either month or manufacturing date (mfd) must be provided');
    }

    // Calculate monthly depreciation cost
    const monthlyDepreciationCost = (initialCost * depreciationPercentage / 100) / 12;

    // Initialize total depreciated cost
    let totalDepreciatedCost = initialCost;

    // Calculate manufacturing month if mfd is provided
    let manufacturingMonth;
    if (mfd) {
      manufacturingMonth = new Date(mfd).getMonth() + 1;
    
    } else if (month>0)
 {
      // If month is provided directly, set manufacturing month to current month
      manufacturingMonth = new Date().getMonth() + 1;
    } else {
      // Throw an error if neither mfd nor month is provided  
      throw new Error('Either month or manufacturing date (mfd) must be provided');
    }

    // Save data for each month until the total depreciated cost becomes less than the monthly depreciation cost
    const endMonth = monthsPassed ? Math.min(startingMonth + monthsPassed, 12) : 12;
    for (let m = startingMonth; m <= endMonth; m++) {
      // Subtract the monthly depreciation cost from the total depreciated cost
      totalDepreciatedCost -= monthlyDepreciationCost;

      // Break out of the loop if the month and depreciation month are the same
      if (month <m) {
        break;
      }

      // Create a new asset document and save it to the database
      const newAsset = new Asset({
        assetId,
        companyId,
        financialYear,
        month: m,
        initialCost,
        depreciationPercentage,
        monthlyDepreciationCost,
        totalDepreciatedCost,
        mfd: mfd ? new Date(mfd) : null, // Convert mfd to Date object if provided
        manufacturingYear: mfd ? new Date(mfd).getFullYear() : null, // Get manufacturing year if mfd is provided
        manufacturingMonth: manufacturingMonth // Set manufacturing month
      });
      await newAsset.save();
    }

    res.status(201).json({ message: 'Asset saved successfully' });
  } catch (error) {
    console.error('Error saving asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch asset data from MongoDB
app.get('/api/assets', async (req, res) => {
  try {
    // Fetch all asset data from MongoDB
    const assets = await Asset.find({});

    res.json({ assets });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to delete all asset data from MongoDB
app.delete('/api/assets', async (req, res) => {
  try {
    // Delete all asset data from MongoDB
    await Asset.deleteMany({});

    res.json({ message: 'All assets deleted successfully' });
  } catch (error) {
    console.error('Error deleting assets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
