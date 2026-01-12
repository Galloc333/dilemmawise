
import pandas as pd
import numpy as np
import plotly.graph_objects as go

def compute_scores_and_contributions(options, criteria):
    """
    Computes total scores and per-criterion contributions for each option.
    
    Args:
        options: List of dicts, e.g., [{'name': 'Option A', 'ratings': {'c1': 5, 'c2': 8}}]
        criteria: List of dicts, e.g., [{'id': 'c1', 'label': 'Price', 'weight': 0.6}, ...]
        
    Returns:
        detailed_results: List of dicts with scores and contributions.
    """
    results = []
    
    # Validate weights sum to approx 1 (optional, depends on business logic)
    total_weight = sum(c['weight'] for c in criteria)
    
    for opt in options:
        contributions = {}
        total_score = 0
        
        for crit in criteria:
            c_id = crit['id']
            weight = crit['weight']
            # Default to 0 if rating missing
            rating = opt['ratings'].get(c_id, 0)
            
            contribution = weight * rating
            contributions[c_id] = contribution
            total_score += contribution
            
        results.append({
            'name': opt['name'],
            'total_score': total_score,
            'contributions': contributions
        })
    
    # Sort by total score descending
    results.sort(key=lambda x: x['total_score'], reverse=True)
    return results

def compute_top_drivers(winner_res, runner_up_res, criteria):
    """
    Identifies the top criteria that drive the score difference between winner and runner-up.
    
    Args:
        winner_res: Dict result for winner (from compute_scores_and_contributions)
        runner_up_res: Dict result for runner-up
        criteria: List of criterion objects to map IDs to labels
        
    Returns:
        drivers: List of dicts {'label': str, 'diff': float, 'advantage': str}
    """
    drivers = []
    criteria_map = {c['id']: c['label'] for c in criteria}
    
    for c_id, label in criteria_map.items():
        w_contrib = winner_res['contributions'].get(c_id, 0)
        r_contrib = runner_up_res['contributions'].get(c_id, 0)
        diff = w_contrib - r_contrib
        
        if abs(diff) > 0.01: # Filter negligible differences
            drivers.append({
                'label': label,
                'diff': diff,
                'advantage': winner_res['name'] if diff > 0 else runner_up_res['name']
            })
            
    # Sort by absolute impact (magnitude of difference)
    drivers.sort(key=lambda x: abs(x['diff']), reverse=True)
    return drivers[:3] # Return top 3

def compute_flip_point_for_criterion(criterion_id, winner, runner_up, criteria, options_data):
    """
    Calculates the weight threshold where the runner-up would beat the winner.
    Assuming we increase/decrease only this weight and re-normalize others proportionally.
    For simplicity here, we often just check 'ceteris paribus' or a simple crossover point calculation.
    
    Equation: Score_W(w) = Score_R(w)
    (w_target * r_W + other_W) = (w_target * r_R + other_R)
    
    This is a simplification. A more robust way is to finding the roots.
    """
    # Find the criterion object
    target_crit = next((c for c in criteria if c['id'] == criterion_id), None)
    if not target_crit:
        return None

    # Get ratings
    w_rating = winner['ratings'].get(criterion_id, 0)
    r_rating = runner_up['ratings'].get(criterion_id, 0)
    
    rating_diff = w_rating - r_rating
    
    if rating_diff == 0:
        return None # Weight change won't affect the gap if ratings are same
    
    # Current score gap
    current_gap = winner['total_score'] - runner_up['total_score']
    
    # If we change weight of crit by delta_w, the gap changes by delta_w * rating_diff
    # We want gap to be 0.
    # NewGap = OldGap + delta_w * rating_diff = 0
    # delta_w = -OldGap / rating_diff
    
    delta_w = -current_gap / rating_diff
    required_weight = target_crit['weight'] + delta_w
    
    # Check if achievable (0 <= w <= 1) - Note: this ignores normalization of others for simplicity
    if 0 <= required_weight <= 1:
        return {
            'criterion': target_crit['label'],
            'current_weight': target_crit['weight'],
            'flip_weight': required_weight,
            'delta': delta_w
        }
    return None

def render_contribution_stacked_bar(results, criteria):
    """
    Generates a Plotly stacked bar chart for contributions.
    """
    data = []
    
    # For each criterion, create a trace (bar segment)
    for crit in criteria:
        c_id = crit['id']
        label = crit['label']
        
        y_values = [res['name'] for res in results]
        x_values = [res['contributions'].get(c_id, 0) for res in results]
        
        data.append(go.Bar(
            name=label,
            y=y_values,
            x=x_values,
            orientation='h',
            hovertemplate=f"<b>{label}</b><br>Contribution: %{{x:.2f}}<extra></extra>"
        ))
        
    fig = go.Figure(data=data)
    fig.update_layout(
        barmode='stack',
        title="Score Contribution by Criterion",
        xaxis_title="Weighted Score",
        yaxis={
            'categoryorder': 'total ascending' # Highest score o top
        },
        template="plotly_white",
        height=400,
        margin=dict(l=20, r=20, t=40, b=20)
    )
    
    return fig

# Example Usage
if __name__ == "__main__":
    # Mock Data
    mock_criteria = [
        {'id': 'c1', 'label': 'Price', 'weight': 0.4},
        {'id': 'c2', 'label': 'Quality', 'weight': 0.6}
    ]
    mock_options = [
        {'name': 'Option A', 'ratings': {'c1': 8, 'c2': 6}}, # Score: 3.2 + 3.6 = 6.8
        {'name': 'Option B', 'ratings': {'c1': 4, 'c2': 9}}, # Score: 1.6 + 5.4 = 7.0 (Winner)
    ]
    
    computed_results = compute_scores_and_contributions(mock_options, mock_criteria)
    winner = computed_results[0]
    runner_up = computed_results[1]
    
    print("Winner:", winner['name'])
    print("Drivers:", compute_top_drivers(winner, runner_up, mock_criteria))
    
    # Flip point for Price?
    flip = compute_flip_point_for_criterion('c1', mock_options[1], mock_options[0], mock_criteria, mock_options)
    print("Flip Analysis:", flip)
    
    # Chart
    fig = render_contribution_stacked_bar(computed_results, mock_criteria)
    # fig.show() 
