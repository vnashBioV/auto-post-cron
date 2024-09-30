import 'dotenv/config';  // Loads environment variables
import axios from 'axios';
import cron from 'node-cron';
import sanityClient from '@sanity/client';
import { v4 as uuidv4 } from 'uuid';  // For generating unique IDs

// Initialize Sanity client
const client = sanityClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  useCdn: false
});

// OpenAI API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/completions';
const openaiApiKey = process.env.OPENAI_API_KEY;

// Placeholder Image API
const PLACEHOLDER_IMAGE_API = "https://via.placeholder.com/800x400.png?text=";

// Utility to generate slug from title
const generateSlug = (title) => title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

// List of dynamic prompts to randomly select from
const promptList = [
  "Write a JavaScript function to reverse a string.",
  "Generate a Python script that reads a CSV file and prints the contents.",
  "Create an HTML page with a simple form and a submit button.",
  "Write a CSS rule that creates a hover effect for buttons.",
  "Generate a JavaScript snippet for handling form validation.",
  "Write a Python script that calculates the factorial of a number.",
  "Create a basic Node.js Express server with one route.",
  "Generate a JavaScript code snippet for async/await function handling.",
  "Write a function in JavaScript to calculate Fibonacci numbers.",
  "Create a batch script to automate file backups.",
  // Add more as needed
];

// Function to randomly select a prompt and generate a code snippet using OpenAI
async function generateCodeSnippet() {
  try {
    // Select a random prompt from the list
    const randomPrompt = promptList[Math.floor(Math.random() * promptList.length)];

    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "text-davinci-003", // Free-tier model
        prompt: randomPrompt,
        max_tokens: 150,
        temperature: 0.5,
      },
      {
        headers: {
          Authorization: `Bearer ${openaiApiKey}`
        }
      }
    );

    const snippet = response.data.choices[0].text.trim();
    console.log("Generated Snippet:", snippet);

    // Create a unique title for the post based on the prompt and date
    const uniqueTitle = `${randomPrompt.split(' ')[1]} Example - ${new Date().toLocaleDateString()}`;

    // Create a problem explanation based on the prompt
    const problemExplanation = generateProblemExplanation(randomPrompt);

    // Save to Sanity database
    await createSanityPost(uniqueTitle, snippet, problemExplanation);
  } catch (error) {
    console.error("Error generating snippet:", error.message);
  }
}

// Function to create a post in Sanity
async function createSanityPost(title, snippet, problemExplanation) {
  try {
    const slug = generateSlug(title); // Generate slug based on title

    // Generate a corresponding image using the placeholder API
    const imageUrl = `${PLACEHOLDER_IMAGE_API}${encodeURIComponent(title)}`;

    const document = {
      _type: 'post',
      title: title,
      slug: { _type: 'slug', current: slug },
      author: {
        _type: 'reference',
        _ref: process.env.SANITY_AUTHOR_ID,  // Author reference ID
      },
      mainImage: {
        _type: 'image',
        asset: {
          _type: 'reference',
          _ref: await uploadImageToSanity(imageUrl),  // Upload and get the image ID
        },
      },
      categories: [
        {
          _type: 'reference',
          _ref: process.env.SANITY_CATEGORY_ID,  // Category reference ID
        },
      ],
      publishedAt: new Date().toISOString(),
      body: [
        {
          _type: 'block',
          children: [{ _type: 'span', text: '🌟 Here’s Today’s Code Snippet! 🌟' }],
        },
        {
          _type: 'block',
          children: [{ _type: 'span', text: '👋 Hello, developers! Ready to level up? Check out today’s code snippet below.' }],
        },
        {
          _type: 'code',
          title: 'Code Snippet',
          code: snippet,
          language: 'javascript',  // Default to JavaScript, can be dynamic
        },
        {
          _type: 'block',
          children: [{ _type: 'span', text: `🧠 What’s happening here? This snippet demonstrates how to ${problemExplanation}.` }],
        },
        {
          _type: 'block',
          children: [{ _type: 'span', text: '💬 Got questions? Share your thoughts below!' }],
        },
      ],
    };

    await client.create(document);
    console.log("Snippet post saved to Sanity.");
  } catch (error) {
    console.error("Error saving snippet post to Sanity:", error.message);
  }
}

// Function to generate a simple problem explanation based on the prompt
function generateProblemExplanation(prompt) {
  const explanationMapping = {
    "Write a JavaScript function to reverse a string.": "reverse a string",
    "Generate a Python script that reads a CSV file and prints the contents.": "read and print contents of a CSV file",
    "Create an HTML page with a simple form and a submit button.": "create a form for user input",
    "Write a CSS rule that creates a hover effect for buttons.": "add hover effects to buttons",
    "Generate a JavaScript snippet for handling form validation.": "validate user input in a form",
    "Write a Python script that calculates the factorial of a number.": "calculate the factorial of a number",
    "Create a basic Node.js Express server with one route.": "set up a basic web server",
    "Generate a JavaScript code snippet for async/await function handling.": "handle asynchronous operations in JavaScript",
    "Write a function in JavaScript to calculate Fibonacci numbers.": "calculate Fibonacci numbers",
    "Create a batch script to automate file backups.": "automate file backups using a batch script",
    // Add more as needed for additional prompts
  };

  return explanationMapping[prompt] || "execute a programming task";  // Fallback if no explanation is found
}

// Function to upload the generated image to Sanity and return the image asset ID
async function uploadImageToSanity(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'base64');

    const imageUploadResponse = await client.assets.upload('image', buffer, {
      filename: `code-snippet-${uuidv4()}.png`,
    });
    return imageUploadResponse._id;  // Return the uploaded image's ID
  } catch (error) {
    console.error("Error uploading image to Sanity:", error.message);
    return null;  // Fallback in case image upload fails
  }
}

// Schedule the cron job to run daily at 9 AM
// Schedule the cron job to run daily at 20:00 (8 PM) SAST (South African Time)
cron.schedule('0 18 * * *', () => {
    console.log("Running cron job to generate and post code snippet...");
    generateCodeSnippet();
  }, {
    timezone: "Africa/Johannesburg"  // South African time zone
});

