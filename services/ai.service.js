import { generateText, Output } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";

const predictionSchema = z.object({
  summary: z.object({
    totalPredictedDemand: z
      .number()
      .describe(
        "Total predicted blood component units required across all predictions"
      ),

    groupsAtRisk: z
      .number()
      .describe(
        "Number of component and blood group combinations with HIGH or CRITICAL risk"
      ),

    criticalGroups: z
      .number()
      .describe(
        "Number of component and blood group combinations with CRITICAL risk"
      ),
  }),

  predictions: z.array(
    z.object({
      component: z.enum([
        "PRBC",
        "Platelets",
        "Plasma",
      ]),

      bloodGroup: z.enum([
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
      ]),

      predictedDemand: z
        .number()
        .describe(
          "Predicted number of units needed during the forecast period"
        ),

      riskLevel: z.enum([
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL",
      ]),

      recommendedUnits: z
        .number()
        .describe(
          "Additional units recommended to collect"
        ),

      reason: z
        .string()
        .describe(
          "Short explanation based only on the provided data"
        ),
    })
  ),

  insights: z.array(
    z.string()
  ),
});


export const generateDemandPrediction = async ({
  forecastPeriod,
  generatedAt,
  demandData,
}) => {
  try {
    const { output } = await generateText({
      model: groq("openai/gpt-oss-20b"),

      output: Output.object({
        schema: predictionSchema,
      }),

      prompt: `
You are an AI assistant that forecasts blood demand for a blood bank.

Your task is to analyze historical blood request demand and current inventory.

FORECAST PERIOD:
${forecastPeriod}

GENERATED AT:
${generatedAt}



==================================================
DATA DEFINITIONS
==================================================

For each component and blood group combination:

totalStock:
Total physical units currently present in the blood bank.

unitsCommitted:
Units already reserved for approved blood requests.

currentStock:
Units currently available for new requests.

last7DaysDemand:
Total units requested during the most recent 7 days.

previous7DaysDemand:
Total units requested during the 7 days before that.

last30DaysDemand:
Total units requested during the last 30 days.

percentageChange:
Percentage increase or decrease in demand compared
with the previous 7-day period.

==================================================
YOUR TASK
==================================================

For each relevant blood component and blood group:

1. Predict the expected demand for the next 7 days.

2. Analyze the demand trend using:
   - last7DaysDemand
   - previous7DaysDemand
   - last30DaysDemand
   - percentageChange

3. Compare predictedDemand with currentStock.

4. Assign one risk level:

LOW:
Current stock is comfortably sufficient.

MEDIUM:
Stock may become insufficient.

HIGH:
There is a significant risk of shortage.

CRITICAL:
Current available stock is insufficient for predicted demand.

5. Calculate recommendedUnits.

recommendedUnits represents the additional number of units
the blood bank should try to collect.

recommendedUnits must:
- Never be negative
- Be 0 if current stock is sufficient
- Be greater than 0 when additional collection is needed

6. Provide a short reason for every prediction.
   Write this reason in plain layman-friendly language for a blood bank staff
   member. Avoid technical field names such as currentStock, unitsCommitted,
   last7DaysDemand, previous7DaysDemand, last30DaysDemand, percentageChange,
   predictedDemand, or recommendedUnits.

==================================================
IMPORTANT RULES
==================================================

- Use ONLY the provided data.
- Do NOT invent external events, disasters, diseases,
  holidays, or medical information.
- Do NOT change the provided inventory values.
- Do NOT predict negative demand.
- predictedDemand must be 0 or greater.
- Return only combinations that have meaningful demand
  or inventory.
- Focus especially on combinations with increasing demand
  or insufficient currentStock.
- Keep reasons concise, useful, and easy to understand for a blood bank operator.
- Write insights in plain language. Prefer words such as "available stock",
  "recent requests", "expected need", and "extra units to collect" instead of
  internal data or AI terms.

==================================================
BLOOD BANK DATA
==================================================

${JSON.stringify(demandData, null, 2)}
`,
    });

    return output;

  } catch (error) {
    console.error("Groq demand prediction error:", error);

    throw new Error(
      "Unable to generate AI demand prediction"
    );
  }
};
