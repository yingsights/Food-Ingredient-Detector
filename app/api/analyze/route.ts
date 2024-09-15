import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { promises as fs } from 'fs'
import path from 'path'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

async function loadUnhealthyIngredients() {
  try {
    const filePath = path.join(process.cwd(), 'unhealthy_ingredients.txt')
    const fileContent = await fs.readFile(filePath, 'utf-8')
    return fileContent.split('\n').map(line => line.trim().toLowerCase()).filter(Boolean)
  } catch (error) {
    console.error('Error loading unhealthy ingredients:', error)
    return []
  }
}

function checkUnhealthyIngredients(ingredients: string, unhealthyList: string[]): string[] {
  const ingredientsLower = ingredients.toLowerCase()
  return unhealthyList.filter(item => ingredientsLower.includes(item))
}

export async function POST(request: NextRequest) {
  console.time('Total API Processing Time');
  try {
    console.log('Received POST request to /api/analyze')
    const data = await request.formData()
    const file: File | null = data.get('image') as unknown as File

    if (!file) {
      console.error('No file uploaded')
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    console.log('File received:', file.name, file.type, 'Size:', file.size, 'bytes')

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    console.time('Gemini AI Processing Time');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    console.log('Calling Gemini AI for ingredient extraction')
    const result = await model.generateContent([
      'Please list all the ingredients shown on this food package image. If the ingredients are not in English, translate them to English. Return the list of ingredients in English, followed by the original text in parentheses if it was translated.',
      {
        inlineData: {
          mimeType: file.type,
          data: buffer.toString('base64')
        }
      }
    ])

    const ingredients = result.response.text()
    console.log('Extracted ingredients:', ingredients)

    console.time('Unhealthy Ingredients Check');
    const unhealthyIngredients = await loadUnhealthyIngredients()
    const foundUnhealthy = checkUnhealthyIngredients(ingredients, unhealthyIngredients)
    console.timeEnd('Unhealthy Ingredients Check');
    console.log('Found unhealthy ingredients:', foundUnhealthy)

    console.log('Calling Gemini AI for analysis')
    const analysisResult = await model.generateContent([
      `Analyze the following list of ingredients and identify any that are generally considered unhealthy or concerning from a nutritional standpoint. Consider factors such as added sugars, trans fats, artificial additives, excessive sodium, and other potentially harmful ingredients. Provide a brief explanation for each identified unhealthy ingredient.

      Ingredients: ${ingredients}

      Additionally, check if any of the following predefined unhealthy ingredients are present: ${unhealthyIngredients.join(', ')}

      Format your response as follows, and make the title font in Bold:
      Unhealthy Ingredients Found In the Curated List:
      [List the ingredients found from the predefined list]
      
      Potentially Unhealthy Ingredients:
      1. [Ingredient Name]: [Brief explanation]
      2. [Ingredient Name]: [Brief explanation]
      ...
      

      Additional Comments:
      [Any additional observations or comments about the overall healthiness of the product]`
    ])

    const analysis = analysisResult.response.text()
    console.timeEnd('Gemini AI Processing Time');
    console.log('Analysis result:', analysis)

    console.timeEnd('Total API Processing Time');
    return NextResponse.json({ 
      ingredients, 
      analysis, 
      foundUnhealthy
    })
  } catch (error) {
    console.error('Detailed error:', error)
    console.timeEnd('Total API Processing Time');
    return NextResponse.json({
      error: 'Error processing image',
      details: error.message,
      stack: error.stack,
      apiKey: process.env.GOOGLE_API_KEY ? 'API key is set' : 'API key is not set'
    }, { status: 500 })
  }
}