const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Gemini API configuration
let geminiAI;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  geminiAI = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
} catch (error) {
  console.error('Error initializing Gemini AI:', error.message);
  console.log('Gemini AI module not available, using fallback mode');
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Updated the API endpoint to handle gift recommendations based on occasion and budget
app.post('/api/recommend', async (req, res) => {
    try {
        const { occasion, budget } = req.body;

        if (!occasion || !budget) {
            return res.status(400).json({ error: 'Occasion and budget are required' });
        }

        let priceRange;
        switch (budget) {
            case 'under-25':
                priceRange = 'under $25';
                break;
            case '25-50':
                priceRange = '$25 to $50';
                break;
            case '50-100':
                priceRange = '$50 to $100';
                break;
            case 'over-100':
                priceRange = 'over $100';
                break;
            default:
                priceRange = 'any price range';
        }

        let recommendations;

        if (geminiAI && process.env.USE_GEMINI_API === 'true') {
            try {
                const prompt = `
                    Act as a gift recommendation expert. 
                    Please recommend 6 gifts based on the following criteria:
                    - Occasion: ${occasion}
                    - Price range: ${priceRange}

                    Format your response as a valid JSON array of objects with these properties:
                    - name: The name of the gift
                    - description: A brief description (max 2 sentences)
                    - price: The approximate price range
                    - url: The website URL (use "#" if unknown)

                    Return ONLY the JSON array with no explanations or other text.
                `;

                const result = await geminiAI.generateContent(prompt);
                const responseText = result.response.text().trim();

                try {
                    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                    const jsonString = jsonMatch ? jsonMatch[0] : responseText;
                    recommendations = JSON.parse(jsonString);
                } catch (parseError) {
                    console.error('Error parsing JSON response:', parseError.message);
                    console.log('Raw response:', responseText);
                    recommendations = [];
                }
            } catch (apiError) {
                console.error('Gemini API Error:', apiError.message);
                recommendations = [];
            }
        } else {
            recommendations = [];
        }

        res.json({ recommendations });
    } catch (error) {
        console.error('Server Error:', error.message);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Gemini API ${geminiAI && process.env.USE_GEMINI_API === 'true' ? 'enabled' : 'disabled'}`);
  });

// Error handling middleware