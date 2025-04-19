import { toast } from "react-toastify";

export const handleApiError = (error) => {
  if (error.response) {
    // The request was made and the server responded with a status code
    const { data, status } = error.response;

    // Check if the error follows your apiError structure
    if (data.message) {
      toast.error(data.message); // Only show the message
    } else if (data.error?.message) {
      toast.error(data.error.message);
    } else {
      toast.error(`Error ${status}: Something went wrong`);
    }
  } else if (error.request) {
    // The request was made but no response was received
    toast.error("Network Error: Please check your internet connection");
  } else {
    // Something happened in setting up the request
    toast.error(error.message);
  }
};
