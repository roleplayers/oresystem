/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
 export const preloadHandlebarsTemplates = async function() {
  return loadTemplates([

    // Actor partials.
    "systems/oresystem/templates/actor/parts/actor-attributes.html",
    "systems/oresystem/templates/actor/parts/actor-powers.html",
    "systems/oresystem/templates/actor/parts/actor-health.html",
    "systems/oresystem/templates/actor/parts/actor-equipment.html",
    
    // Dialog templates
    "systems/oresystem/templates/dialogs/advanced-roll-dialog.html",
    "systems/oresystem/templates/dialogs/weapon-advanced-roll-dialog.html",
  ]);
};