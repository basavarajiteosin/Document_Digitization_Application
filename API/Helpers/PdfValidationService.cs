using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;

public class PdfValidationService
{
    public bool IsPdfPasswordProtected(byte[] pdfBytes)
    {
        try
        {
            try
            {
                using (PdfDocument document = PdfReader.Open(new MemoryStream(pdfBytes), PdfDocumentOpenMode.ReadOnly))
                {
                   
                        // The PDF is password-protected
                        return false;
                }
                  
            }
            catch (PdfReaderException)
            {
                // Handle the case where the PDF is invalid or corrupted
                return true;
            }
        }
        catch (Exception ex)
        {
            // Handle exceptions appropriately, e.g., invalid PDF file
            return BadRequest(ex.Message);
        }
    }

    private bool BadRequest(string message)
    {
        throw new NotImplementedException();
    }
}
