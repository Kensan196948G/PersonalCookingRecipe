import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation } from 'react-query';
import { recipeService } from '../services/recipeService';
import { categoryService } from '../services/categoryService';
import LoadingSpinner from '../components/LoadingSpinner';
import { Plus, Trash2, ArrowLeft, Save, Upload } from 'lucide-react';
import { toast } from 'react-toastify';

const RecipeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [imagePreview, setImagePreview] = useState(null);

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      description: '',
      category_id: '',
      prep_time: '',
      cook_time: '',
      servings: '',
      difficulty: 'medium',
      instructions: '',
      notes: '',
      ingredients: [{ name: '', amount: '', unit: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'ingredients'
  });

  const { data: categories } = useQuery('categories', categoryService.getAll);

  const { data: recipe, isLoading } = useQuery(
    ['recipe', id],
    () => recipeService.getById(id),
    {
      enabled: isEdit,
      onSuccess: (data) => {
        reset({
          ...data,
          category_id: data.category_id || '',
          prep_time: data.prep_time || '',
          cook_time: data.cook_time || '',
          servings: data.servings || '',
          ingredients: data.ingredients || [{ name: '', amount: '', unit: '' }]
        });
        if (data.image_url) {
          setImagePreview(`http://localhost:5000${data.image_url}`);
        }
      }
    }
  );

  const createMutation = useMutation(
    (data) => recipeService.create(data),
    {
      onSuccess: (recipe) => {
        toast.success('Recipe created successfully');
        navigate(`/recipes/${recipe.id}`);
      },
      onError: () => {
        toast.error('Failed to create recipe');
      }
    }
  );

  const updateMutation = useMutation(
    (data) => recipeService.update(id, data),
    {
      onSuccess: () => {
        toast.success('Recipe updated successfully');
        navigate(`/recipes/${id}`);
      },
      onError: () => {
        toast.error('Failed to update recipe');
      }
    }
  );

  const onSubmit = (data) => {
    const formData = { ...data };
    
    // Filter out empty ingredients
    formData.ingredients = formData.ingredients.filter(ing => ing.name && ing.amount);
    
    // Convert numeric fields
    if (formData.prep_time) formData.prep_time = parseInt(formData.prep_time);
    if (formData.cook_time) formData.cook_time = parseInt(formData.cook_time);
    if (formData.servings) formData.servings = parseInt(formData.servings);
    
    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (isEdit && isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isEdit ? 'Edit Recipe' : 'Add New Recipe'}
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                {...register('title', { required: 'Title is required' })}
                className="input-field"
                placeholder="Enter recipe title"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                {...register('description')}
                className="input-field"
                rows="2"
                placeholder="Brief description of the recipe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select {...register('category_id')} className="input-field">
                <option value="">Select a category</option>
                {categories?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipe Image
              </label>
              <div className="flex items-center space-x-4">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    {...register('image')}
                    onChange={handleImageChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="btn-secondary flex items-center space-x-2">
                    <Upload className="h-4 w-4" />
                    <span>Choose Image</span>
                  </div>
                </label>
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-20 w-20 object-cover rounded-lg"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Recipe Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Recipe Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prep Time (min)
                </label>
                <input
                  {...register('prep_time')}
                  type="number"
                  min="0"
                  className="input-field"
                  placeholder="30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cook Time (min)
                </label>
                <input
                  {...register('cook_time')}
                  type="number"
                  min="0"
                  className="input-field"
                  placeholder="45"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Servings
                </label>
                <input
                  {...register('servings')}
                  type="number"
                  min="1"
                  className="input-field"
                  placeholder="4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty
                </label>
                <select {...register('difficulty')} className="input-field">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
              <button
                type="button"
                onClick={() => append({ name: '', amount: '', unit: '' })}
                className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Add Ingredient</span>
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <input
                    {...register(`ingredients.${index}.amount`)}
                    className="input-field w-24"
                    placeholder="Amount"
                  />
                  <input
                    {...register(`ingredients.${index}.unit`)}
                    className="input-field w-24"
                    placeholder="Unit"
                  />
                  <input
                    {...register(`ingredients.${index}.name`)}
                    className="input-field flex-1"
                    placeholder="Ingredient name"
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructions *
            </label>
            <textarea
              {...register('instructions', { required: 'Instructions are required' })}
              className="input-field"
              rows="6"
              placeholder="Step-by-step cooking instructions..."
            />
            {errors.instructions && (
              <p className="mt-1 text-sm text-red-600">{errors.instructions.message}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              {...register('notes')}
              className="input-field"
              rows="3"
              placeholder="Additional notes or tips..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isLoading || updateMutation.isLoading}
              className="btn-primary flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{isEdit ? 'Update Recipe' : 'Create Recipe'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecipeForm;