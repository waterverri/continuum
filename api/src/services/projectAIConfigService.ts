import { supabaseAdmin } from '../db/supabaseClient';

export interface ProjectAIConfig {
  provider_id: string;
  model_id: string;
  last_updated: string;
  updated_by: string;
}

export class ProjectAIConfigService {
  /**
   * Update the project's AI configuration with the latest provider and model used
   */
  static async updateProjectAIConfig(
    projectId: string,
    providerId: string,
    modelId: string,
    userId: string
  ): Promise<void> {
    try {
      const aiConfig: ProjectAIConfig = {
        provider_id: providerId,
        model_id: modelId,
        last_updated: new Date().toISOString(),
        updated_by: userId
      };

      const { error } = await supabaseAdmin
        .from('projects')
        .update({
          ai_config: aiConfig
        })
        .eq('id', projectId);

      if (error) {
        console.error('Failed to update project AI config:', error);
        // Don't throw - this is not critical functionality
      } else {
        console.log(`Updated AI config for project ${projectId}: ${providerId}/${modelId}`);
      }
    } catch (error) {
      console.error('Error updating project AI config:', error);
      // Don't throw - this is not critical functionality
    }
  }

  /**
   * Get the project's AI configuration to use as defaults
   */
  static async getProjectAIConfig(projectId: string): Promise<ProjectAIConfig | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('projects')
        .select('ai_config')
        .eq('id', projectId)
        .single();

      if (error || !data?.ai_config) {
        return null;
      }

      return data.ai_config as ProjectAIConfig;
    } catch (error) {
      console.error('Error getting project AI config:', error);
      return null;
    }
  }
}