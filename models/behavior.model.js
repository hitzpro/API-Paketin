import { supabase } from "../config/supabase.js";

export const BehaviorModel = {
  // Simpan log survey
  async saveSurvey(userId, surveyData) {
    return await supabase.from("user_behaviors").insert([{
      user_id: userId,
      behavior_type: "onboarding_survey",
      data: surveyData
    }]);
  }
};